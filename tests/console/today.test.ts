import { describe, expect, it } from "vitest";
import { entriesPerDay, eventGroup } from "@/lib/console/format/log";
import { buyerOrders, isSeeded } from "@/lib/console/format/orders";
import { duration } from "@/lib/console/format/time";
import { todayVerdict } from "@/lib/console/format/verdict";
import { basketOf, pendingOrder } from "./fixtures";

const NOW = Date.parse("2026-11-14T10:00:00.000Z");

describe("buyer orders", () => {
  it("keeps only the mandate's buyer", () => {
    const other = pendingOrder({ id: "x", buyer: { id: "other", name: "Other" } });
    const mandate = { jws: "", mandate: { buyer: { id: "fi:ovt:003712345678" } } } as never;
    expect(buyerOrders([pendingOrder(), other], mandate).map((order) => order.id)).toEqual(["ord_1"]);
  });

  it("reads the seeded mark only when it is set", () => {
    expect(isSeeded({ ...pendingOrder(), seeded: true })).toBe(true);
    expect(isSeeded(pendingOrder())).toBe(false);
  });
});

describe("the verdict", () => {
  it("leads with the basket, then any single order that waits", () => {
    const basket = basketOf(["green", "green", "orange", "red"]);
    expect(todayVerdict({ basket, waitingOrders: 0, chainBroken: false, suspended: false })).toEqual({
      text: "Your agent ordered 2 lines. 1 needs you. 1 is blocked.",
      tone: "waiting",
    });
    expect(todayVerdict({ basket, waitingOrders: 1, chainBroken: false, suspended: false }).text).toBe("Your agent ordered 2 lines. 1 needs you. 1 is blocked. 1 other order needs you.");
  });

  it("puts a changed record or a stopped agent first", () => {
    const facts = { basket: basketOf(["green"]), waitingOrders: 0 };
    expect(todayVerdict({ ...facts, chainBroken: true, suspended: false }).tone).toBe("danger");
    expect(todayVerdict({ ...facts, chainBroken: false, suspended: true }).text).toBe("Valio Aimo stopped your agent. It cannot order now.");
  });

  it("points at the weekly order before any basket exists", () => {
    expect(todayVerdict({ waitingOrders: 0, chainBroken: false, suspended: false })).toEqual({ text: "Your weekly order is ready to send.", tone: "calm" });
  });
});

describe("the log", () => {
  it("counts entries per Helsinki day for the last seven days", () => {
    const days = entriesPerDay([{ at: "2026-11-14T08:00:00Z" }, { at: "2026-11-13T22:30:00Z" }, { at: "2026-11-01T08:00:00Z" }], NOW);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ date: "2026-11-14", label: "Sat", today: true, count: 2 });
    expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(2);
  });

  it("groups events for the filter", () => {
    expect(eventGroup("approval.granted")).toBe("approvals");
    expect(eventGroup("access.refused")).toBe("refused");
    expect(eventGroup("order.blocked")).toBe("refused");
    expect(eventGroup("approval.rejected")).toBe("refused");
  });
});

describe("duration", () => {
  it("says how long a run took", () => {
    expect(duration(400)).toBe("under 1 s");
    expect(duration(6_200)).toBe("6 s");
    expect(duration(64_000)).toBe("1 min 4 s");
  });
});
