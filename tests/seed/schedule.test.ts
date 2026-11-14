import { describe, expect, it } from "vitest";
import { deliverySlot, helsinkiInstant, orderCutoff, workingDaysBefore } from "@/lib/seed/schedule";
import { SeedUpstream } from "@/lib/seed/upstream";
import type { UpstreamAvailability, UpstreamClient } from "@/lib/valio/types";

const at = (iso: string) => new Date(iso);

describe("seed schedule", () => {
  it("turns Helsinki wall-clock times into instants, in winter and in summer", () => {
    expect(helsinkiInstant("2026-11-12", "08:15").toISOString()).toBe("2026-11-12T06:15:00.000Z");
    expect(helsinkiInstant("2026-07-01", "08:00").toISOString()).toBe("2026-07-01T05:00:00.000Z");
  });

  it("counts working days back from today, skipping weekends", () => {
    expect(workingDaysBefore(at("2026-11-14T09:00:00+02:00"), 5)).toEqual(["2026-11-13", "2026-11-12", "2026-11-11", "2026-11-10", "2026-11-09"]);
    expect(workingDaysBefore(at("2026-11-16T09:00:00+02:00"), 2)).toEqual(["2026-11-13", "2026-11-12"]);
  });

  it("closes orders at 16:00 on the last working day before delivery", () => {
    expect(orderCutoff("2026-11-11").toISOString()).toBe("2026-11-10T14:00:00.000Z");
    expect(orderCutoff("2026-11-16").toISOString()).toBe("2026-11-13T14:00:00.000Z");
  });

  it("asks for the first delivery still open, or the next working day after its cut-off when told to miss it", () => {
    expect(deliverySlot(at("2026-11-10T08:00:00+02:00"), false).deliverBy).toBe("2026-11-11");
    expect(deliverySlot(at("2026-11-10T16:30:00+02:00"), false).deliverBy).toBe("2026-11-12");
    const missed = deliverySlot(at("2026-11-10T16:30:00+02:00"), true);
    expect(missed).toEqual({ deliverBy: "2026-11-11", orderBy: at("2026-11-10T16:00:00+02:00") });
    expect(deliverySlot(at("2026-11-14T09:00:00+02:00"), false).deliverBy).toBe("2026-11-17");
  });
});

describe("seed upstream", () => {
  const recorded: UpstreamClient = {
    price: async (ids) => new Map(ids.map((id) => [id, { productId: id, found: true, net: 1, contractPrice: false }])),
    availability: async () =>
      new Map<string, UpstreamAvailability>([
        ["1", { productId: "1", deliverable: true, salesBlock: false, available: 51, availableDate: "2026-11-16", orderBy: "2026-11-15T15:00:00.000Z" }],
        ["2", { productId: "2", deliverable: false, salesBlock: false, available: 0 }],
      ]),
  };

  it("replays prices and stock and moves dates to the slot of the current request", async () => {
    const upstream = new SeedUpstream(recorded);
    upstream.setSlot({ deliverBy: "2026-11-11", orderBy: at("2026-11-10T16:00:00+02:00") });
    const answers = await upstream.availability(["1", "2"], "2026-11-11", "123");
    expect(answers.get("1")).toMatchObject({ available: 51, availableDate: "2026-11-11", orderBy: "2026-11-10T14:00:00.000Z" });
    expect(answers.get("2")).toEqual({ productId: "2", deliverable: false, salesBlock: false, available: 0 });
    expect((await upstream.price(["1"], "2026-11-11", "123")).get("1")?.net).toBe(1);
  });
});
