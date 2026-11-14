import { describe, expect, it } from "vitest";
import type { Check, Order, OfferLine } from "@/lib/contracts";
import { runReason } from "@/lib/console/format/run-view";
import type { RunBlock } from "@/lib/console/runs";
import { substitutionChoice, substitutionReason } from "@/lib/console/format/substitution";
import { pendingOrder } from "./fixtures";

const ARLA = "Arla Milkdrink 1L lactose free fat free UHT Suomesta";

/** 200 litres of Arla's milk, of which 51 were in stock: the signed alternative is a like-for-like Valio milk. */
function substituteLine(extra: Partial<NonNullable<OfferLine["substituteFor"]>> = {}): OfferLine {
  return {
    productId: "464306",
    name: "Valio Eila semi skimmed milk drink 1 l lactose free",
    categoryGroup: "dairy",
    quantity: 200,
    salesUnit: "ST",
    content: { amount: 200, unit: "l" },
    unitPrice: { amount: 1.01, currency: "EUR" },
    comparisonPrice: { amount: 1.01, per: "l" },
    taxRate: 13.5,
    lineNet: { amount: 202, currency: "EUR" },
    availability: { status: "available", requested: 200, stock: "tracked", available: 900, deliveryDate: "2026-11-16" },
    substituteFor: {
      productId: "462775",
      name: ARLA,
      reason: `Only 51 of 200 units of ${ARLA} are in stock.`,
      likeForLike: true,
      priceChangePct: -57.2,
      ...extra,
    },
  };
}

function substituted(lines: OfferLine[], checks: Check[]): Order {
  const order = pendingOrder({ status: "confirmed" });
  order.offer.lines = lines;
  order.decision = { outcome: "auto_approved", checks };
  return order;
}

const POLICY_PASS: Check = { rule: "substitution.policy", status: "pass", message: "1 substitute fits the substitution policy.", observed: "1 substitute", limit: "like_for_like" };
const PRICE_PASS: Check = { rule: "substitution.price", status: "pass", message: "Within limit.", observed: "-57.2 %", limit: "+10 %" };

describe("substitutionReason", () => {
  it("explains a like-for-like substitute from the signed order alone", () => {
    const order = substituted([substituteLine()], [POLICY_PASS, PRICE_PASS]);
    expect(substitutionReason(order)).toBe(
      "Arla Milkdrink fat-free lactose-free UHT 1 l had 51 of the 200 needed. " +
        "The signed alternative, Eila semi-skimmed lactose-free milk 1 l, is the same kind of product with the same claims and no new allergen, " +
        "57% cheaper per litre, in full on Monday. Your rules allow a like-for-like substitute.",
    );
    expect(substitutionChoice(order)).toBe(
      "The signed alternative, Eila semi-skimmed lactose-free milk 1 l, is the same kind of product with the same claims and no new allergen, " +
        "57% cheaper per litre, in full on Monday. Your rules allow a like-for-like substitute.",
    );
  });

  it("names the part kept when the alternative splits the line", () => {
    const kept: OfferLine = { ...substituteLine(), productId: "462775", name: ARLA, quantity: 51, substituteFor: undefined };
    const fill = { ...substituteLine(), quantity: 149, content: { amount: 149, unit: "l" as const } };
    expect(substitutionChoice(substituted([kept, fill], [POLICY_PASS, PRICE_PASS]))).toMatch(
      /^The signed alternative keeps those 51 and fills the rest with Eila semi-skimmed lactose-free milk 1 l: the same kind of product/,
    );
  });

  it("says when the substitute costs more than the buyer's limit, and when it is not like for like", () => {
    const dearer = substituted([substituteLine({ priceChangePct: 14 })], [POLICY_PASS, { ...PRICE_PASS, status: "ask" }]);
    expect(substitutionChoice(dearer)).toContain("14% dearer per litre");
    expect(substitutionChoice(dearer)).toContain("It costs more than your 10% limit for substitutes, so a person decides.");
    const unlike = substituted([substituteLine({ likeForLike: false })], [{ ...POLICY_PASS, status: "ask" }, PRICE_PASS]);
    expect(substitutionChoice(unlike)).toContain("is a different kind of product");
    expect(substitutionChoice(unlike)).toContain("Your rules ask a person to approve a substitute that is not like for like.");
    const none = substituted([substituteLine()], [{ ...POLICY_PASS, status: "block", limit: "none" }]);
    expect(substitutionChoice(none)).toContain("Your rules allow no substitutes, so it was not ordered.");
  });

  it("keeps a reason that is not short stock as the wholesaler wrote it", () => {
    const cutoff = substituted([substituteLine({ reason: `The order cut-off for ${ARLA} has passed.` })], [POLICY_PASS]);
    expect(substitutionReason(cutoff)).toMatch(/^The order cut-off for Arla .* has passed\. The signed alternative/);
  });

  it("has nothing to say when no line is a substitute", () => {
    expect(substitutionReason(pendingOrder())).toBeUndefined();
    expect(substitutionChoice(undefined)).toBeUndefined();
  });

  it("is what the run view shows under a run that took a substitute", () => {
    const order = substituted([substituteLine()], [POLICY_PASS, PRICE_PASS]);
    const run = { kind: "purchase", orderIds: [order.id] } as RunBlock;
    expect(runReason(run, { orders: new Map([[order.id, order]]), active: false })).toMatch(/^Arla .* had 51 of the 200 needed\./);
    expect(runReason({ ...run, kind: "attempts" }, { orders: new Map([[order.id, order]]), active: false })).toBeUndefined();
  });
});
