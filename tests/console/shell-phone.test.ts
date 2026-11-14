import { describe, expect, it } from "vitest";
import { deadline, orderPhase, phoneChecks, substitutionRule } from "@/components/approve-phone/phone-order";
import type { Check, Order } from "@/lib/contracts";
import { pendingOrder } from "./fixtures";

const AFTER_EXPIRY = Date.parse("2026-11-14T07:20:00.000Z");
const HOLD = { heldUntil: "2026-11-15T12:00:00.000Z", jws: "a.b.c" };

function withSubstitution(check: Partial<Check>): Order {
  const order = pendingOrder({
    offer: {
      ...pendingOrder().offer,
      requestCheck: [
        { requirement: "brand", asked: "Arla", offered: "Valio Arki Eila 1 l", result: "substituted", certain: false },
        { requirement: "quantity", asked: "1,800 l", offered: "1,800 l", result: "met", certain: false },
      ],
    },
  });
  const rule: Check = { rule: "substitution.policy", status: "pass", message: "Fine.", ...check };
  return { ...order, decision: { ...order.decision, checks: [...order.decision.checks, rule] } };
}

describe("the phone's deadline", () => {
  it("uses the signed price hold when the order carries one, else the offer's expiry", () => {
    expect(deadline(pendingOrder())).toBe("2026-11-14T07:15:00.000Z");
    expect(deadline(pendingOrder({ priceHold: HOLD }))).toBe(HOLD.heldUntil);
  });

  it("keeps an order open past the offer's expiry while the price is held", () => {
    expect(orderPhase(pendingOrder(), AFTER_EXPIRY)).toBe("expired");
    expect(orderPhase(pendingOrder({ priceHold: HOLD }), AFTER_EXPIRY)).toBe("pending");
  });
});

describe("the request checks on the phone", () => {
  it("names the delivered product on each row and gives a substitute the rule that allowed it", () => {
    const [brand, quantity] = phoneChecks(withSubstitution({ limit: "like_for_like" }));
    expect(brand).toEqual({
      label: "Brand",
      asked: "Arla",
      offered: "Valio Arki Eila 1 l",
      result: "substituted",
      word: "Substitute",
      rule: "Your rules allow a like-for-like substitute.",
    });
    expect(quantity).toMatchObject({ word: "Matches" });
    expect(quantity.rule).toBeUndefined();
  });

  it("says when the rules ask a person about the substitute", () => {
    expect(substitutionRule(withSubstitution({ status: "ask" }))).toBe("Your rules ask a person to approve a substitute that is not like for like.");
    expect(substitutionRule(withSubstitution({}))).toBe("Your rules allow a substitute within your price limit.");
  });

  it("shows nothing when the offer carries no buyer's words", () => {
    expect(phoneChecks(pendingOrder())).toEqual([]);
  });
});
