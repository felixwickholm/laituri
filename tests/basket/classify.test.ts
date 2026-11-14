import { describe, expect, it } from "vitest";
import type { Check, Order, OfferLine, ReasonCode } from "@/lib/contracts";
import { classifyNoOrder, classifyOrder, type Familiarity, type Verdict } from "@/lib/basket/classify";
import { testMandate } from "../support/deps";

const NEW: Familiarity = { history: { timesOrdered: 0 }, sameAsLastWeek: false };

function line(overrides: Partial<OfferLine> = {}): OfferLine {
  return {
    productId: "464306",
    name: "Valio Eila milk 1 l",
    categoryGroup: "dairy",
    quantity: 1000,
    salesUnit: "ST",
    content: { amount: 1000, unit: "l" },
    unitPrice: { amount: 1.01, currency: "EUR" },
    taxRate: 13.5,
    lineNet: { amount: 1010, currency: "EUR" },
    availability: { status: "available", requested: 1000, deliveryDate: "2026-11-16" },
    ...overrides,
  };
}

function order(status: Order["status"], checks: Partial<Check>[] = [], extra: { net?: number; lines?: OfferLine[]; requestCheck?: Order["offer"]["requestCheck"] } = {}): Order {
  const net = extra.net ?? 1010;
  return {
    id: "ord_1",
    status,
    createdAt: "2026-11-14T07:00:00.000Z",
    updatedAt: "2026-11-14T07:00:00.000Z",
    mandateId: "mandate:test",
    agent: { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" },
    buyer: { id: "buyer:harbour", name: "Nordic Harbour Hotels" },
    offer: {
      id: "off_1",
      issuer: "Valio Aimo",
      customerNumber: "123",
      buyer: { id: "buyer:harbour", name: "Nordic Harbour Hotels" },
      issuedAt: "2026-11-14T07:00:00.000Z",
      expiresAt: "2026-11-14T07:15:00.000Z",
      matchConfidence: "high",
      deliverBy: "2026-11-16",
      deliveryDate: "2026-11-17",
      fulfilment: "full",
      lines: extra.lines ?? [line()],
      totals: { net: { amount: net, currency: "EUR" }, tax: { amount: 0, currency: "EUR" }, gross: { amount: net, currency: "EUR" } },
      notes: [],
      ...(extra.requestCheck ? { requestCheck: extra.requestCheck } : {}),
      source: { system: "test", pricedAt: "2026-11-14T07:00:00.000Z" },
    },
    decision: {
      outcome: status === "confirmed" ? "auto_approved" : status === "blocked" ? "blocked" : "needs_approval",
      checks: checks.map((check) => ({ rule: "spend.per_order", status: "pass", message: "", ...check }) as Check),
    },
    simulated: true,
  };
}

const swapLine = line({
  productId: "464401",
  name: "Valio skimmed milk 1 l",
  substituteFor: { productId: "462775", name: "Arla UHT milk", reason: "Only 51 of 200 units of Arla UHT milk are in stock.", likeForLike: true, priceChangePct: 4 },
});

const classify = (o: Order, known: Familiarity = NEW) => classifyOrder(o, testMandate(), known);

/** Every reason code, the state it shows and the sentence a kitchen manager reads. */
const CASES: [string, Verdict, ReasonCode][] = [
  ["confirmed, new", classify(order("confirmed")), "ordered"],
  ["over the per-order limit", classify(order("pending_approval", [{ rule: "spend.per_order", status: "ask" }], { net: 1615.2 })), "over_limit"],
  ["over the weekly limit", classify(order("pending_approval", [{ rule: "spend.per_week", status: "ask" }])), "over_limit"],
  ["swap costs more", classify(order("pending_approval", [{ rule: "substitution.price", status: "ask", observed: "+12.5 %" }], { lines: [swapLine] })), "price_changed"],
  ["swap misses a stated word", classify(order("pending_approval", [{ rule: "match.confidence", status: "ask" }], {
    lines: [swapLine],
    requestCheck: [{ requirement: "attribute", asked: "UHT", offered: "chilled", result: "unmet", certain: false }],
  })), "substitute_needs_ok"],
  ["first-time product", classify(order("pending_approval", [{ rule: "product.first_time", status: "ask" }])), "new_product"],
  ["untracked large quantity", classify(order("pending_approval", [{ rule: "delivery.partial", status: "ask", observed: "untracked stock" }])), "partial"],
  ["unclear words", classify(order("pending_approval", [{ rule: "match.confidence", status: "ask" }])), "request_unclear"],
  ["outside the categories", classify(order("pending_approval", [{ rule: "category.allowed", status: "ask" }])), "request_unclear"],
  ["a day late", classify(order("pending_approval", [{ rule: "delivery.deadline", status: "ask" }])), "no_stock_in_time"],
  ["contains nuts", classify(order("blocked", [{ rule: "dietary.allergens", status: "block", message: "Almond drink contains nuts.", observed: "nuts" }])), "allergen"],
  ["stock taken", classify(order("blocked", [{ rule: "offer.expiry", status: "block", observed: "stock taken" }])), "no_stock_in_time"],
  ["cut-off passed", classify(order("blocked", [{ rule: "offer.expiry", status: "block", observed: "cutoff_passed" }])), "cutoff_passed"],
  ["no swaps allowed", classify(order("blocked", [{ rule: "substitution.policy", status: "block" }])), "refused"],
  ["rejected", classify(order("rejected")), "refused"],
  ["nothing found", classifyNoOrder({ kind: "not_found" }), "not_found"],
  ["no words", classifyNoOrder({ kind: "unclear" }), "request_unclear"],
  ["too much", classifyNoOrder({ kind: "too_much" }), "refused"],
  ["date passed", classifyNoOrder({ kind: "date_passed" }), "cutoff_passed"],
  ["short stock with a swap", classifyNoOrder({ kind: "short", line: line({ availability: { status: "partial", requested: 200, available: 51 } }), alternatives: 1 }), "partial"],
  ["nothing in time", classifyNoOrder({ kind: "short", line: line({ availability: { status: "unavailable", requested: 200 } }), alternatives: 0 }), "no_stock_in_time"],
  ["cut-off passed, no alternative", classifyNoOrder({ kind: "short", line: line({ availability: { status: "cutoff_passed", requested: 200 } }), alternatives: 0 }), "cutoff_passed"],
  ["no answer from the wholesaler", classifyNoOrder({ kind: "no_answer" }), "refused"],
  ["an error", classifyNoOrder({ kind: "error" }), "refused"],
];

describe("line verdicts", () => {
  it.each(CASES)("%s", (_name, verdict, code) => {
    expect(verdict.reasonCode).toBe(code);
    expect(verdict.reason.split(/\s+/).length).toBeLessThanOrEqual(14);
  });

  it("covers every reason code", () => {
    expect(new Set(CASES.map(([, , code]) => code))).toEqual(
      new Set(["ordered", "over_limit", "substitute_needs_ok", "new_product", "partial", "request_unclear", "price_changed", "allergen", "no_stock_in_time", "cutoff_passed", "not_found", "refused"]),
    );
  });

  it("colours by what happened: confirmed green, waiting orange, blocked red", () => {
    for (const [, verdict] of CASES) {
      if (verdict.reasonCode === "ordered") expect(verdict.state).toBe("green");
      if (["over_limit", "substitute_needs_ok", "new_product", "price_changed"].includes(verdict.reasonCode)) expect(verdict.state).toBe("orange");
      if (["allergen", "not_found"].includes(verdict.reasonCode)) expect(verdict.state).toBe("red");
    }
  });

  it("says the euros over the order limit and what a swap changes", () => {
    expect(CASES[1][1].reason).toBe("€116 over your order limit.");
    expect(CASES[4][1].reason).toBe("Only 51 in stock. The swap is not UHT.");
    expect(CASES[10][1].reason).toBe("Contains nuts. Your rules say no.");
    expect(CASES[19][1].reason).toBe("Only 51 in stock. A like-for-like swap is ready.");
  });

  it("says the order history on a green line", () => {
    const confirmed = order("confirmed");
    expect(classify(confirmed, { history: { timesOrdered: 6 }, sameAsLastWeek: false }).reason).toBe("Ordered. You bought this 6 times.");
    expect(classify(confirmed, { history: { timesOrdered: 3 }, sameAsLastWeek: true }).reason).toBe("Ordered. Same as last week.");
    expect(classify(confirmed, { history: { timesOrdered: 1 }, sameAsLastWeek: false }).reason).toBe("Ordered. You bought this once before.");
    expect(classify(order("confirmed", [], { lines: [swapLine] })).reason).toBe("Ordered a like-for-like swap. Inside your limits.");
  });

  it("names the never-buy list on a line it blocks, before any other block", () => {
    const listed = classify(order("blocked", [{ rule: "product.never_buy", status: "block", message: "Alpro almond drink is on your never-buy list." }, { rule: "dietary.allergens", status: "block", message: "Alpro almond drink contains nuts.", observed: "nuts" }]));
    expect(listed).toMatchObject({ state: "red", reasonCode: "refused", reason: "On your never-buy list. Nothing was ordered." });
  });

    it("tells a trace from an ingredient", () => {
    const trace = classify(order("blocked", [{ rule: "dietary.allergens", status: "block", message: "Ciabatta may contain sesame.", observed: "sesame" }]));
    expect(trace.reason).toBe("May contain sesame. Your rules say no.");
  });
});
