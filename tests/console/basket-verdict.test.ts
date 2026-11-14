import { describe, expect, it } from "vitest";
import { basketVerdictOf, ideaText, isoWeek, weeklyBasket } from "@/lib/console/basket-verdict";
import { basketOf } from "./fixtures";

const NOW = Date.parse("2026-11-14T10:00:00.000Z");

describe("Today's weekly verdict", () => {
  it("says the week number in Helsinki time", () => {
    expect(isoWeek(NOW)).toBe(46);
    expect(isoWeek(Date.parse("2026-01-01T10:00:00.000Z"))).toBe(1);
    expect(isoWeek(Date.parse("2026-11-15T22:30:00.000Z"))).toBe(47);
  });

  it("leads with the most urgent thing", () => {
    expect(basketVerdictOf(basketOf(["green", "orange", "orange", "red"]))).toEqual({ kind: "needs", headline: "2 lines need you.", open: 3 });
    expect(basketVerdictOf(basketOf(["green", "red"])).headline).toBe("1 line is blocked.");
    expect(basketVerdictOf(basketOf(["green", "green"])).headline).toBe("All 2 ordered.");
    expect(basketVerdictOf(basketOf(["green", "working", "working"]))).toMatchObject({ kind: "working", headline: "Ordering 1 of 3…" });
  });

  it("stops counting a line once a person decided on it", () => {
    const basket = basketOf(["green", "orange"]);
    basket.lines[1].resolved = { at: "2026-11-14T09:00:00.000Z", optionId: "approve", sentence: "Approved." } as never;
    expect(basketVerdictOf(basket)).toMatchObject({ kind: "done", open: 0 });
  });

  it("keeps this week's weekly order, never a shop order", () => {
    const weekly = basketOf(["green"]);
    const shop = basketOf(["working"], { id: "bsk_2", source: "manual", createdAt: "2026-11-14T09:00:00.000Z" });
    const old = basketOf(["green"], { id: "bsk_0", createdAt: "2026-11-06T08:00:00.000Z" });
    expect(weeklyBasket([shop, weekly, old], NOW)?.id).toBe("bsk_1");
    expect(weeklyBasket([shop, old], NOW)).toBeUndefined();
  });

  it("gives each idea one line", () => {
    expect(ideaText({ kind: "low_pantry", headline: "Rice is low", sentence: "Rice is low: 4 kg left." })).toBe("Rice is low");
    expect(ideaText({ kind: "seasonal", headline: "Valio Aimo suggests", sentence: "Valio Aimo suggests gingerbread oat drink." })).toBe("Gingerbread oat drink.");
  });
});
