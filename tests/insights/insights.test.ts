import { describe, expect, it } from "vitest";
import { SupplierOverview } from "@/lib/contracts";
import {
  connectedAgents,
  dailySeries,
  firedRules,
  medianSecondsRequestToConfirmed,
  offerStats,
  orderOutcome,
  orderStats,
  requestOfOrder,
  summariseRequests,
  supplierOverview,
  topConcepts,
  unmetRequests,
} from "@/lib/insights";
import { HARBOUR, KAISLA, KAISLA_AGENT, NOW, activity, offerIssued, order, record, signedOffer } from "./fixtures";

const ASK_LIMIT = { rule: "spend.per_order" as const, status: "ask" as const, message: "Order total 1,616.00 EUR is over the 1,500.00 EUR limit.", observed: "1,616.00 EUR", limit: "1,500.00 EUR" };
const BLOCK_NUTS = { rule: "dietary.allergens" as const, status: "block" as const, message: "Almond drink contains nuts.", observed: "nuts", limit: "exclude peanut, nuts" };

const ORDERS = [
  order({ id: "o1", status: "confirmed", net: 1010, createdAt: "2026-11-13T06:00:00.000Z" }),
  order({ id: "o2", status: "confirmed", net: 1616, createdAt: "2026-11-13T07:00:00.000Z", approved: true, checks: [ASK_LIMIT] }),
  order({ id: "o3", status: "pending_approval", net: 909, createdAt: "2026-11-14T06:55:00.000Z", checks: [ASK_LIMIT], agent: KAISLA_AGENT, buyer: KAISLA }),
  order({ id: "o4", status: "rejected", net: 454.5, createdAt: "2026-11-12T08:10:00.000Z", checks: [ASK_LIMIT] }),
  order({ id: "o5", status: "blocked", net: 97.2, createdAt: "2026-11-12T06:20:00.000Z", checks: [BLOCK_NUTS], seeded: true }),
];

const REQUESTS = [
  record({ id: "d1", requestId: "r1", at: "2026-11-13T05:59:00.000Z", words: "lactose-free milk", concept: "milk", quantity: { amount: 1000, unit: "l" } }),
  record({ id: "d2", requestId: "r1", at: "2026-11-13T05:59:30.000Z", kind: "quote", words: "1,000 litres of lactose-free milk by Monday", concept: "milk", quantity: { amount: 1000, unit: "l" } }),
  record({ id: "d3", requestId: "r2", at: "2026-11-13T14:42:00.000Z", kind: "quote", words: "300 litres of milk for tomorrow", concept: "milk", quantity: { amount: 300, unit: "l" }, outcome: "cutoff_passed", lostNet: 303 }),
  record({ id: "d4", requestId: "r3", at: "2026-11-12T05:58:00.000Z", words: "gluten-free rye bread", concept: "bread", outcome: "not_found", agent: KAISLA_AGENT, buyer: KAISLA, client: "ChatGPT", seeded: true }),
  record({ id: "d5", requestId: "r4", at: "2026-11-12T08:41:00.000Z", kind: "quote", concept: "whipping_cream", quantity: { amount: 40, unit: "l" }, outcome: "met_with_alternative" }),
];

describe("orders", () => {
  it("names each outcome the way the wholesaler counts it", () => {
    expect(ORDERS.map(orderOutcome)).toEqual(["confirmed_auto", "confirmed_after_approval", "waiting", "rejected", "blocked"]);
  });

  it("counts and sums by outcome in whole cents", () => {
    const stats = orderStats(ORDERS);
    expect(stats.total).toEqual({ count: 5, net: 4086.7 });
    expect(stats.byOutcome.confirmed_after_approval).toEqual({ count: 1, net: 1616 });
    expect(stats.byOutcome.blocked).toEqual({ count: 1, net: 97.2 });
  });
});

describe("demand", () => {
  const requests = summariseRequests(REQUESTS);

  it("folds a search and its quotes into one request that ends as the last record says", () => {
    expect(requests).toHaveLength(4);
    expect(requests.find((r) => r.requestId === "r1")).toMatchObject({
      at: "2026-11-13T05:59:00.000Z",
      words: "1,000 litres of lactose-free milk by Monday",
      outcome: "met_in_full",
    });
  });

  it("ranks product types by requests and totals the quantity per unit", () => {
    expect(topConcepts(requests)).toEqual([
      { concept: "milk", requests: 2, quantity: [{ amount: 1300, unit: "l" }] },
      { concept: "bread", requests: 1, quantity: [] },
      { concept: "whipping_cream", requests: 1, quantity: [{ amount: 40, unit: "l" }] },
    ]);
  });

  it("lists unmet requests newest first with the reason and the lost value when known", () => {
    const unmet = unmetRequests(requests);
    expect(unmet.map((r) => [r.requestId, r.reason, r.estimatedLostNet])).toEqual([
      ["r2", "cutoff_passed", 303],
      ["r3", "not_found", undefined],
    ]);
    expect(unmet[1]).toMatchObject({ buyer: KAISLA, client: "ChatGPT", reasonText: "Nothing in the catalogue matches.", seeded: true });
  });
});

describe("agents", () => {
  const items = [
    activity({ id: "a1", at: "2026-11-12T06:00:00.000Z", client: "Scripted buyer agent" }),
    activity({ id: "a2", at: "2026-11-13T06:00:00.000Z", tool: "request_quote" }),
    activity({ id: "a3", at: "2026-11-13T06:01:00.000Z", tool: "request_quote", status: "error" }),
    activity({ id: "a4", at: "2026-11-13T06:02:00.000Z", kind: "note", tool: undefined }),
  ];

  it("summarises each agent with its buyer, client apps, calls, orders and status", () => {
    const [kaisla, harbour] = connectedAgents(items, ORDERS, NOW);
    expect(harbour).toMatchObject({
      agent: { id: "agent:harbour-purchasing" },
      buyer: HARBOUR,
      clients: ["Claude Code", "Scripted buyer agent"],
      firstSeen: "2026-11-12T06:00:00.000Z",
      lastSeen: "2026-11-13T07:00:00.000Z",
      calls: 3,
      quotes: 1,
      confirmedNet: 2626,
      status: "active",
    });
    expect(harbour.orders).toEqual({ confirmed_auto: 1, confirmed_after_approval: 1, waiting: 0, rejected: 1, blocked: 1, refused: 0 });
    expect(kaisla).toMatchObject({ agent: KAISLA_AGENT, buyer: KAISLA, clients: [], calls: 0, status: "active" });
  });

  it("calls an agent idle after a day without calls", () => {
    const [agent] = connectedAgents(items, [], new Date("2026-11-15T09:00:00+02:00"));
    expect(agent.status).toBe("idle");
  });
});

describe("offers", () => {
  it("counts ordered, expired and open offers and the median time to order", () => {
    const offers = [
      signedOffer("off_o1", "2026-11-13T05:59:00.000Z", "2026-11-13T06:14:00.000Z"),
      signedOffer("off_o2", "2026-11-13T06:58:00.000Z", "2026-11-13T07:13:00.000Z"),
      signedOffer("off_unused", "2026-11-13T06:00:00.000Z", "2026-11-13T06:15:00.000Z"),
      signedOffer("off_open", "2026-11-14T06:58:00.000Z", "2026-11-14T07:13:00.000Z"),
    ];
    expect(offerStats(offers, ORDERS, NOW)).toEqual({
      signed: 4,
      ordered: 2,
      expiredUnused: 1,
      open: 1,
      conversionRate: 0.5,
      medianSecondsToOrder: 90,
    });
    expect(offerStats([], [], NOW)).toEqual({ signed: 0, ordered: 0, expiredUnused: 0, open: 0, conversionRate: 0 });
  });
});

describe("request to confirmed order", () => {
  const LIVE = [
    record({ id: "s1", requestId: "r1", at: "2026-11-14T06:00:00.000Z" }),
    record({ id: "q1", requestId: "r1", at: "2026-11-14T06:00:30.000Z", kind: "quote", offerId: "off_r1" }),
    record({ id: "q2", requestId: "r2", at: "2026-11-14T06:10:00.000Z", kind: "quote", offerId: "off_r2" }),
    record({ id: "s3", requestId: "r3", at: "2026-11-14T06:20:00.000Z" }),
    record({ id: "q3", requestId: "r3", at: "2026-11-14T06:20:20.000Z", kind: "quote", offerId: "off_r3" }),
  ];
  const SEEDED = [record({ id: "q9", requestId: "r9", at: "2026-11-10T06:00:00.000Z", kind: "quote", offerId: "off_r9", seeded: true })];
  const AUDIT = [offerIssued(1, "off_r2", ["off_r2_alt"]), offerIssued(2, "off_r9", ["off_r9_alt"])];

  it("measures from the first search, or the first quote, to each order confirmed without a person", () => {
    const orders = [
      order({ id: "a", status: "confirmed", net: 10, offerId: "off_r1", createdAt: "2026-11-14T06:01:30.000Z" }),
      order({ id: "b", status: "confirmed", net: 10, offerId: "off_r2_alt", createdAt: "2026-11-14T06:10:40.000Z" }),
      order({ id: "c", status: "confirmed", net: 10, offerId: "off_r3", createdAt: "2026-11-14T06:21:01.000Z" }),
    ];
    // 90 s from r1's search, 40 s from r2's quote via the alternative it issued, 61 s from r3's search.
    expect(medianSecondsRequestToConfirmed(LIVE, orders, AUDIT)).toBe(61);
  });

  it("leaves out approved, waiting and blocked orders and everything seeded", () => {
    const orders = [
      order({ id: "a", status: "confirmed", net: 10, offerId: "off_r1", createdAt: "2026-11-14T06:01:30.000Z" }),
      order({ id: "approved", status: "confirmed", approved: true, net: 10, offerId: "off_r3", createdAt: "2026-11-14T08:00:00.000Z" }),
      order({ id: "waiting", status: "pending_approval", net: 10, offerId: "off_r3", createdAt: "2026-11-14T08:00:00.000Z" }),
      order({ id: "blocked", status: "blocked", net: 10, offerId: "off_r3", createdAt: "2026-11-14T08:00:00.000Z" }),
      order({ id: "seeded-order", status: "confirmed", net: 10, offerId: "off_r3", createdAt: "2026-11-14T08:00:00.000Z", seeded: true }),
      order({ id: "seeded-request", status: "confirmed", net: 10, offerId: "off_r9_alt", createdAt: "2026-11-14T08:00:00.000Z" }),
      order({ id: "unknown-offer", status: "confirmed", net: 10, offerId: "off_elsewhere", createdAt: "2026-11-14T08:00:00.000Z" }),
    ];
    expect(medianSecondsRequestToConfirmed([...LIVE, ...SEEDED], orders, AUDIT)).toBe(90);
    expect(medianSecondsRequestToConfirmed(SEEDED, orders, AUDIT)).toBeUndefined();
  });

  it("appears in the overview only once there is something to measure", () => {
    const input = { now: NOW, offers: [], activity: [], suspensions: [], audit: AUDIT, requests: LIVE };
    const measured = supplierOverview({ ...input, orders: [order({ id: "a", status: "confirmed", net: 10, offerId: "off_r1", createdAt: "2026-11-14T06:01:30.000Z" })] });
    expect(SupplierOverview.parse(measured).orders.medianSecondsRequestToConfirmed).toBe(90);
    expect(supplierOverview({ ...input, orders: [] }).orders).not.toHaveProperty("medianSecondsRequestToConfirmed");
  });
});

describe("rules", () => {
  it("counts the rules that held or stopped orders, without the buyer's limits", () => {
    const rules = firedRules(ORDERS);
    expect(rules).toEqual([
      { rule: "spend.per_order", title: "Per-order limit", tier: "ask", count: 3 },
      { rule: "dietary.allergens", title: "Never-buy allergens", tier: "block", count: 1 },
    ]);
    expect(JSON.stringify(rules)).not.toContain("1,500.00");
  });
});

describe("daily series", () => {
  it("covers the seven Helsinki days ending today", () => {
    const days = dailySeries(summariseRequests(REQUESTS), ORDERS, new Set(["r1"]), NOW);
    expect(days.map((d) => d.date)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(days[5]).toEqual({ date: "2026-11-13", requests: 2, ordered: 1, orders: 2, confirmed: 2, confirmedNet: 2626 });
    expect(days[6]).toEqual({ date: "2026-11-14", requests: 0, ordered: 0, orders: 1, confirmed: 0, confirmedNet: 0 });
  });
});

describe("requests against orders", () => {
  // One request, three orders: its offer, an alternative its quote issued, and a second order after a rejection.
  const LOG = [
    record({ id: "s1", requestId: "r1", at: "2026-11-14T06:00:00.000Z" }),
    record({ id: "q1", requestId: "r1", at: "2026-11-14T06:00:30.000Z", kind: "quote", offerId: "off_r1" }),
    record({ id: "q1b", requestId: "r1", at: "2026-11-14T06:05:00.000Z", kind: "quote", offerId: "off_r1b" }),
    record({ id: "s2", requestId: "r2", at: "2026-11-14T06:10:00.000Z", outcome: "not_found" }),
    record({ id: "q3", requestId: "r3", at: "2026-11-13T15:00:00.000Z", kind: "quote", offerId: "off_r3" }),
  ];
  const AUDIT = [offerIssued(1, "off_r1", ["off_r1_alt"])];
  const PLACED = [
    order({ id: "a", status: "rejected", net: 10, offerId: "off_r1", createdAt: "2026-11-14T06:01:00.000Z" }),
    order({ id: "b", status: "confirmed", net: 10, offerId: "off_r1_alt", createdAt: "2026-11-14T06:02:00.000Z" }),
    order({ id: "c", status: "confirmed", net: 10, offerId: "off_r1b", createdAt: "2026-11-14T06:06:00.000Z" }),
    // Quoted yesterday, ordered today.
    order({ id: "d", status: "confirmed", net: 10, offerId: "off_r3", createdAt: "2026-11-14T06:20:00.000Z" }),
    order({ id: "e", status: "confirmed", net: 10, offerId: "off_unlogged", createdAt: "2026-11-14T06:30:00.000Z" }),
  ];

  it("links each order to the request whose quote signed its offer, alternatives included", () => {
    expect(Object.fromEntries(requestOfOrder(LOG, PLACED, AUDIT))).toEqual({ a: "r1", b: "r1", c: "r1", d: "r3" });
  });

  it("never shows more requests that led to an order than requests, on any day or in the week", () => {
    const { daily } = supplierOverview({ now: NOW, orders: PLACED, offers: [], requests: LOG, activity: [], suspensions: [], audit: AUDIT });
    const today = daily[daily.length - 1];
    expect(today).toMatchObject({ date: "2026-11-14", requests: 2, ordered: 1, orders: 5 });
    for (const day of daily) expect(day.ordered).toBeLessThanOrEqual(day.requests);
    const sum = (key: "requests" | "ordered") => daily.reduce((total, day) => total + day[key], 0);
    expect(sum("requests")).toBe(3);
    expect(sum("ordered")).toBe(2);
  });
});

describe("supplier overview", () => {
  it("matches the published schema and says when seeded history is included", () => {
    const overview = supplierOverview({ now: NOW, orders: ORDERS, offers: [], requests: REQUESTS, activity: [], suspensions: [], audit: [] });
    expect(SupplierOverview.safeParse(overview).success).toBe(true);
    expect(overview).toMatchObject({ generatedAt: NOW.toISOString(), includesSeeded: true, demand: { requests: 4 } });
    expect(supplierOverview({ now: NOW, orders: [], offers: [], requests: [], activity: [], suspensions: [], audit: [] }).includesSeeded).toBe(false);
  });
});

describe("baskets", () => {
  it("counts a line as ordered without a person only when it is green and no person resolved it", async () => {
    const { basketStats } = await import("@/lib/insights");
    const resolved = { optionId: "line_2-approve", by: "Maria Lind", at: "2026-11-13T07:00:00.000Z", sentence: "Approved." };
    const stats = basketStats([{ lines: [{ state: "green" }, { state: "green", resolved }, { state: "orange" }, { state: "working" }] }]);
    expect(stats).toEqual({ count: 1, lines: 4, autoShare: 0.333 });
  });

  it("counts an order a person chose in a basket as confirmed after a person, not alone", () => {
    const chosen = order({ id: "o9", status: "confirmed", net: 100, createdAt: "2026-11-13T08:00:00.000Z" });
    const resolved = { optionId: "line_1-swap-1", by: "Maria Lind", at: "2026-11-13T08:00:00.000Z", sentence: "Swapped." };
    const view = supplierOverview({
      now: NOW, orders: [chosen], offers: [], requests: [], activity: [], suspensions: [], audit: [],
      baskets: [{ lines: [{ state: "green", orderId: "o9", resolved }] }],
    });
    expect(view.orders.byOutcome.confirmed_auto.count).toBe(0);
    expect(view.orders.byOutcome.confirmed_after_approval.count).toBe(1);
  });
});

