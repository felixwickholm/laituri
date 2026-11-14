import { describe, expect, it } from "vitest";
import { driftSentences, lineDrift, type WeekOfOrders } from "@/lib/basket/drift";
import { previousBasket } from "@/lib/basket/history";
import { standingOrder } from "@/lib/basket/standing";
import type { StoredBasket } from "@/lib/basket/types";
import { usualProductId, weeklyCutoff, weeklyDeliverBy, weeklyDraft, weeklyRequest } from "@/lib/basket/weekly";
import { openHours } from "@/lib/handoffs/open-hours";
import { BUYER_IDS } from "@/lib/mandate/defaults";

const week = (lines: [string, number, string][]): WeekOfOrders => ({ lines: lines.map(([label, amount, unit]) => ({ label, amount, unit })) });

describe("drift", () => {
  it("says what crept up and what held steady", () => {
    const weeks = [
      week([["Cream", 25, "l"], ["Eggs", 36, "kg"], ["Milk", 900, "l"]]),
      week([["Cream", 28, "l"], ["Eggs", 36, "kg"], ["Milk", 950, "l"]]),
      week([["Cream", 32, "l"], ["Eggs", 36, "kg"], ["Milk", 1000, "l"]]),
      week([["Cream", 35, "l"], ["Eggs", 36, "kg"], ["Milk", 1000, "l"]]),
    ];
    expect(driftSentences(weeks)).toEqual(["Cream is up 40% in four weeks.", "Eggs: 36 kg again, same as the last three weeks."]);
  });

  it("says a fall too, largest moves first, at most two", () => {
    const weeks = [week([["Yoghurt", 60, "kg"], ["Oat drink", 40, "l"], ["Cream", 25, "l"]]), week([["Yoghurt", 50, "kg"], ["Oat drink", 50, "l"], ["Cream", 30, "l"]]), week([["Yoghurt", 45, "kg"], ["Oat drink", 60, "l"], ["Cream", 35, "l"]])];
    expect(driftSentences(weeks)).toEqual(["Oat drink is up 50% in three weeks.", "Cream is up 40% in three weeks."]);
    expect(driftSentences([week([["Yoghurt", 60, "kg"]]), week([["Yoghurt", 50, "kg"]]), week([["Yoghurt", 45, "kg"]])])).toEqual(["Yoghurt is down 25% in three weeks."]);
  });

  it("says nothing with fewer than three weeks", () => {
    expect(driftSentences([week([["Cream", 25, "l"]]), week([["Cream", 50, "l"]])])).toEqual([]);
  });
});

/** A finished weekly basket of an earlier week, as the seed leaves it. */
function pastBasket(buyerId: string, createdAt: string, amounts: Record<string, number>): StoredBasket {
  return {
    id: `bsk_${createdAt}`,
    title: "Weekly order",
    source: "weekly",
    buyer: { id: buyerId, name: "Buyer" },
    deliverBy: "2026-11-09",
    createdAt,
    status: "done",
    agent: { id: "agent", name: "Agent", buyer: { id: buyerId, name: "Buyer" } },
    usage: { calls: 0, productsAsked: 0 },
    lines: Object.entries(amounts).map(([words, amount], index) => ({
      id: `line_${index + 1}`,
      words,
      asked: { amount, unit: "l" },
      state: "green",
      reason: "Ordered.",
      request: { words, quantity: { amount, unit: "l" } },
      held: {},
    })),
  };
}

describe("the standing weekly order", () => {
  const saturday = new Date("2026-11-14T09:00:00+02:00");

  it("is for next Monday, with the cut-off the day before at 17:00", () => {
    expect(weeklyDeliverBy(saturday)).toBe("2026-11-16");
    expect(weeklyCutoff("2026-11-16")).toBe("2026-11-15T15:00:00.000Z");
  });

  it("has about 20, 16 and 12 lines for the three buyers", () => {
    expect(weeklyRequest(BUYER_IDS.nordicHarbour, "2026-11-16").lines).toHaveLength(20);
    expect(weeklyRequest(BUYER_IDS.kaisla, "2026-11-16").lines).toHaveLength(16);
    expect(weeklyRequest(BUYER_IDS.laine, "2026-11-16").lines).toHaveLength(12);
    expect(weeklyRequest(BUYER_IDS.nordicHarbour, "2026-11-16").lines[0]).toEqual({ words: "1,000 litres of lactose-free milk", quantity: { amount: 1000, unit: "l" } });
  });

  it("plays only the trend lines in older weeks, and skips lines new this week", () => {
    const older = weeklyRequest(BUYER_IDS.nordicHarbour, "2026-10-19", 0, true).lines.map((line) => line.words);
    expect(older).toEqual(standingOrder(BUYER_IDS.nordicHarbour).filter((line) => line.trend).map((line) => line.words));
    expect(weeklyRequest(BUYER_IDS.nordicHarbour, "2026-11-09", 3).lines.map((line) => line.words)).not.toContain("Alpro almond drink");
  });

  it("drafts this week against last week's basket, ignoring baskets of this week", () => {
    const harbour = BUYER_IDS.nordicHarbour;
    const baskets = [
      pastBasket(harbour, "2026-10-22T07:30:00.000Z", { "lactose-free whipping cream": 25 }),
      pastBasket(harbour, "2026-10-29T07:30:00.000Z", { "lactose-free whipping cream": 28 }),
      pastBasket(harbour, "2026-11-05T07:30:00.000Z", { "lactose-free whipping cream": 32, butter: 60 }),
      pastBasket(harbour, "2026-11-12T07:30:00.000Z", { "lactose-free whipping cream": 35 }),
      pastBasket(BUYER_IDS.kaisla, "2026-11-12T08:00:00.000Z", { butter: 999 }),
    ];
    const draft = weeklyDraft(harbour, baskets, saturday);
    // 12 Nov is this ISO week, so last week's basket is the one of 5 Nov.
    expect(draft.lines.find((line) => line.words === "butter")).toMatchObject({ change: "more", lastWeek: { amount: 60 }, note: "Christmas baking starts this week." });
    expect(draft.lines.find((line) => line.words === "lactose-free whipping cream")).toMatchObject({ change: "more", note: "Up from 32 l last week." });
    expect(draft.lines.find((line) => line.words === "eggs for the breakfast buffets")?.change).toBe("new");
    expect(draft.drift).toEqual([{ sentence: "Cream is up 28% in three weeks." }]);
  });
});

describe("Valio Aimo's open hours", () => {
  const at = (iso: string, context?: Parameters<typeof openHours>[1]) => openHours(new Date(iso), context);
  const cutoff = "2026-11-15T15:00:00.000Z";

  it("answers on weekdays from 8:00 to 16:00 Helsinki time", () => {
    expect(at("2026-11-16T10:00:00+02:00")).toEqual({ open: true, sentence: "A person at Valio Aimo answers today before 16:00." });
  });

  it("says when a person answers outside those hours, and that a waiting order is safe only when there is one", () => {
    expect(at("2026-11-14T09:00:00+02:00").sentence).toBe("Valio Aimo answers on Monday from 8:00.");
    expect(at("2026-11-16T07:00:00+02:00", { hasOrder: true }).sentence).toBe("Valio Aimo answers today from 8:00. Your order is safe until then.");
    expect(at("2026-11-16T22:00:00+02:00", { hasOrder: true }).sentence).toBe("Valio Aimo answers tomorrow from 8:00. Your order is safe until then.");
    expect(at("2026-11-13T16:30:00+02:00").sentence).toBe("Valio Aimo answers on Monday from 8:00.");
  });

  it("says plainly when the next answer comes after the order cut-off", () => {
    const expected = "Valio Aimo answers on Monday from 8:00, after the order cut-off (Sun 17:00). Decide yourself to keep Monday's delivery.";
    expect(at("2026-11-14T09:00:00+02:00", { cutoff, deliverBy: "2026-11-16", hasOrder: true }).sentence).toBe(expected);
    expect(at("2026-11-14T09:00:00+02:00", { cutoff, deliverBy: "2026-11-16" }).sentence).toBe(expected);
    // Friday evening, cut-off next Wednesday: Monday's answer still comes in time.
    expect(at("2026-11-13T16:30:00+02:00", { cutoff: "2026-11-17T15:00:00.000Z", deliverBy: "2026-11-18", hasOrder: true }).sentence).toBe(
      "Valio Aimo answers on Monday from 8:00. Your order is safe until then.",
    );
  });
});

describe("last week", () => {
  const harbour = BUYER_IDS.nordicHarbour;

  it("is a basket of an earlier ISO week, never one of the same week", () => {
    const thisWeek = { ...pastBasket(harbour, "2026-11-12T07:30:00.000Z", { butter: 60 }), id: "bsk_now" };
    const sameWeek = pastBasket(harbour, "2026-11-12T06:30:00.000Z", { butter: 60 });
    const lastWeek = pastBasket(harbour, "2026-11-05T07:30:00.000Z", { butter: 60 });
    expect(previousBasket([lastWeek, sameWeek, thisWeek], thisWeek)?.id).toBe(lastWeek.id);
    expect(previousBasket([sameWeek, thisWeek], thisWeek)).toBeUndefined();
  });

  it("gives the product a regular line ordered last week, for the same words only", () => {
    const last = pastBasket(harbour, "2026-11-05T07:30:00.000Z", { "grated cheese": 20, butter: 60 });
    last.lines[0].product = { id: "476753", name: "Valio cheese mix" };
    last.lines[1] = { ...last.lines[1], state: "orange", product: { id: "464411", name: "Valio butter" } };
    expect(usualProductId(last, { words: "grated cheese", quantity: { amount: 20, unit: "kg" } })).toBe("476753");
    // Only a green line counts, and a product the kitchen fixed wins.
    expect(usualProductId(last, { words: "butter", quantity: { amount: 60, unit: "kg" } })).toBeUndefined();
    expect(usualProductId(last, { words: "grated cheese", quantity: { amount: 20, unit: "kg" }, productId: "1" })).toBeUndefined();
    expect(usualProductId(undefined, { words: "grated cheese", quantity: { amount: 20, unit: "kg" } })).toBeUndefined();
  });
});

describe("drift on a weekly line", () => {
  it("stops an amount half again above or below the four-week median", () => {
    expect(lineDrift({ amount: 120, usual: [60, 60, 60, 60], cap: 0.1 })).toBe("Twice your usual amount. Check it.");
    expect(lineDrift({ amount: 60, usual: [40, 40, 40, 40], cap: 0.1 })).toBe("Up 50% on your usual 4 weeks.");
    expect(lineDrift({ amount: 250, usual: [60], cap: 0.1 })).toBe("Up 317% on your usual week.");
    expect(lineDrift({ amount: 20, usual: [40, 40, 50], cap: 0.1 })).toBe("Down 50% on your usual 3 weeks.");
    expect(lineDrift({ amount: 60, usual: [40, 50, 50, 60], cap: 0.1 })).toBeUndefined();
    expect(lineDrift({ amount: 60, usual: [], cap: 0.1 })).toBeUndefined();
  });

  it("stops a unit price that rose more than the mandate's cap against last week", () => {
    expect(lineDrift({ amount: 10, usual: [10], price: { now: 1.2, last: 1 }, cap: 0.1 })).toBe("Price up 20% on last week. Check it.");
    expect(lineDrift({ amount: 10, usual: [10], price: { now: 1.1, last: 1 }, cap: 0.1 })).toBeUndefined();
    expect(lineDrift({ amount: 10, usual: [10], price: { now: 0.5, last: 1 }, cap: 0.1 })).toBeUndefined();
  });
});
