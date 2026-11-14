import { describe, expect, it } from "vitest";
import type { Basket } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";
import { basketSentence, foldBaskets, linesByAttention } from "@/lib/supplier-console/baskets";
import { offerSentences, overviewFacts, speedLine } from "@/lib/supplier-console/overview";
import type { ControlOverview } from "@/lib/supplier-console/types";

const HARBOUR = { id: "buyer:harbour", name: "Nordic Harbour Hotels" };

function basket(extra: Partial<Basket> = {}): Basket {
  return {
    id: "bsk_1",
    title: "Weekly order",
    source: "weekly",
    buyer: HARBOUR,
    deliverBy: "2026-11-16",
    createdAt: "2026-11-14T08:00:00.000Z",
    status: "done",
    lines: [
      { id: "l1", words: "milk", asked: { amount: 1000, unit: "l" }, state: "green", reason: "Ordered.", orderId: "ord_1", offerId: "off_1" },
      { id: "l2", words: "peanuts", asked: { amount: 5, unit: "kg" }, state: "red", reason: "Contains nuts." },
      { id: "l3", words: "cream", asked: { amount: 40, unit: "l" }, state: "orange", reason: "Needs your OK.", offerId: "off_3" },
    ],
    totals: { lines: 20, green: 17, orange: 2, red: 1, working: 0, netOrdered: 4000, netWaiting: 300, minutesByHand: 20 },
    summary: "17 of 20 lines ordered. 2 need you. 1 is blocked.",
    ...extra,
  };
}

function call(id: string, at: string, extra: Partial<Activity> = {}): Activity {
  return { id, at, agent: { id: "agent:harbour", name: "Harbour agent" }, buyer: HARBOUR, kind: "tool", tool: "search_catalog", title: "Searched", status: "ok", ...extra };
}

describe("baskets as one event", () => {
  it("reads a weekly order as one line", () => {
    expect(basketSentence(basket())).toBe("Weekly order · 20 lines · 17 ordered, 2 need the customer, 1 blocked");
  });

  it("opens on the lines that stopped", () => {
    expect(linesByAttention(basket().lines).map((line) => line.state)).toEqual(["red", "orange", "green"]);
  });

  it("folds the basket's calls into one row and keeps other calls", () => {
    const calls = [
      call("c1", "2026-11-14T08:00:05.000Z"),
      call("c2", "2026-11-14T08:00:30.000Z", { tool: "place_order", refs: { orderId: "ord_1" } }),
      call("c3", "2026-11-14T09:00:00.000Z"),
      call("c4", "2026-11-14T08:00:10.000Z", { buyer: { id: "buyer:kaisla", name: "Kaisla School Kitchens" } }),
    ];
    const feed = foldBaskets(calls, [basket()]);
    expect(feed.map((item) => (item.kind === "basket" ? item.basket.id : item.call.id))).toEqual(["c3", "bsk_1", "c4"]);
    expect(feed[1].at).toBe("2026-11-14T08:00:30.000Z");
  });
});

function overview(extra: Partial<ControlOverview>): ControlOverview {
  return extra as ControlOverview;
}

describe("overview facts", () => {
  it("shows only what the server reports", () => {
    expect(overviewFacts(overview({}))).toEqual([]);
  });

  it("states the share ordered without a person and the waiting questions", () => {
    const facts = overviewFacts(overview({ baskets: { count: 2, lines: 40, autoShare: 0.86 }, handoffs: { open: 2 } }));
    expect(facts.map((fact) => fact.text)).toEqual(["Lines ordered without a person: 86%", "2 questions wait for a person."]);
    expect(facts[1].link?.href).toBe("/valio/handoffs");
  });

  it("says the fixed prices in sentences", () => {
    expect(offerSentences({ signed: 10, ordered: 7, expiredUnused: 2, open: 1, conversionRate: 0.7 })).toEqual([
      "Valio Aimo signed 10 fixed prices.",
      "7 became orders (70%).",
      "2 ran out unused.",
      "1 can still be used.",
    ]);
  });

  it("says the speed from a finished basket, and never a zero median", () => {
    const orders = { medianSecondsRequestToConfirmed: 0 } as ControlOverview["orders"];
    expect(speedLine(overview({ orders }), [basket({ totals: { ...basket().totals, secondsTaken: 6.5 } })])).toBe("Weekly order: 20 lines in 7 s. By hand: about 20 min.");
    expect(speedLine(overview({ orders }), [])).toBeUndefined();
    expect(speedLine(overview({ orders: { ...orders, medianSecondsRequestToConfirmed: 35 } }), undefined)).toMatch(/^Typical time from request to confirmed order: 35\s+s\.$/);
  });
});
