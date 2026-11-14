import type { Basket, BasketLine, Check, LineState, Order } from "@/lib/contracts";

const PASS = (rule: Check["rule"], message = "Fine."): Check => ({ rule, status: "pass", message });

/** A pending order of 1,800 l lactose-free milk, over a 1,500 EUR per-order limit. */
export function pendingOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord_1",
    status: "pending_approval",
    createdAt: "2026-11-14T07:00:00.000Z",
    updatedAt: "2026-11-14T07:00:00.000Z",
    mandateId: "mandate:nordic-harbour:purchasing",
    agent: { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" },
    buyer: { id: "fi:ovt:003712345678", name: "Nordic Harbour Hotels" },
    offer: {
      id: "off_1",
      issuer: "Valio Aimo",
      customerNumber: "123",
      buyer: { id: "fi:ovt:003712345678", name: "Nordic Harbour Hotels" },
      issuedAt: "2026-11-14T07:00:00.000Z",
      expiresAt: "2026-11-14T07:15:00.000Z",
      intent: "1,800 l lactose-free milk",
      matchConfidence: "high",
      deliverBy: "2026-11-16",
      deliveryDate: "2026-11-16",
      fulfilment: "full",
      lines: [
        {
          productId: "464306",
          name: "Valio Arki Eila 1 l",
          categoryGroup: "dairy",
          quantity: 1800,
          salesUnit: "ST",
          content: { amount: 1800, unit: "l" },
          unitPrice: { amount: 1.01, currency: "EUR" },
          taxRate: 13.5,
          lineNet: { amount: 1818, currency: "EUR" },
          availability: { status: "available", requested: 1800, available: 1800, deliveryDate: "2026-11-16" },
        },
      ],
      totals: { net: { amount: 1818, currency: "EUR" }, tax: { amount: 245.43, currency: "EUR" }, gross: { amount: 2063.43, currency: "EUR" } },
      notes: [],
      source: { system: "valio-aimo", pricedAt: "2026-11-14T07:00:00.000Z" },
    },
    decision: {
      outcome: "needs_approval",
      checks: [
        PASS("offer.signature"),
        {
          rule: "spend.per_order",
          status: "ask",
          message: "Order total 1,818.00 EUR is over the 1,500.00 EUR limit.",
          observed: "1,818.00 EUR",
          limit: "1,500.00 EUR",
        },
        PASS("match.confidence"),
      ],
    },
    simulated: true,
    ...overrides,
  };
}

export function blockedOrder(): Order {
  const order = pendingOrder({ id: "ord_2", status: "blocked" });
  order.decision = {
    outcome: "blocked",
    checks: [
      { rule: "dietary.allergens", status: "block", message: "Hazelnut spread contains nuts.", observed: "nuts", limit: "exclude peanut, nuts" },
    ],
  };
  return order;
}

const REASON: Record<LineState, string> = {
  green: "Ordered. Same as last week.",
  orange: "Over your per-order limit.",
  red: "Contains nuts. Your rules say no.",
  working: "",
};

/** A basket with one line per state given, in that order, ten euros a line. */
export function basketOf(states: LineState[], overrides: Partial<Basket> = {}): Basket {
  const lines: BasketLine[] = states.map((state, index) => ({
    id: `line_${index + 1}`,
    words: `product ${index + 1}`,
    asked: { amount: 10, unit: "kg" },
    state,
    reason: REASON[state],
    ...(state === "working" ? {} : { net: 10, orderId: `ord_b${index + 1}` }),
    ...(state === "orange" ? { options: [{ id: "approve", kind: "approve" as const, label: "Approve" }, { id: "skip", kind: "skip" as const, label: "Leave it out" }, { id: "ask", kind: "handoff" as const, label: "Ask Valio Aimo" }] } : {}),
  }));
  const tally = (state: LineState) => states.filter((item) => item === state).length;
  return {
    id: "bsk_1",
    title: "Weekly order",
    source: "weekly",
    buyer: { id: "fi:ovt:003712345678", name: "Nordic Harbour Hotels" },
    deliverBy: "2026-11-16",
    createdAt: "2026-11-14T08:00:00.000Z",
    status: states.includes("working") ? "running" : "done",
    lines,
    totals: { lines: states.length, green: tally("green"), orange: tally("orange"), red: tally("red"), working: tally("working"), netOrdered: tally("green") * 10, netWaiting: tally("orange") * 10, secondsTaken: 8, minutesByHand: states.length },
    summary: "",
    ...overrides,
  };
}
