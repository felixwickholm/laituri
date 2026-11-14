import type { Check, Decision, Outcome } from "@/lib/contracts";
import type { Base, EvaluateInput, Rule } from "./context";
import { check } from "./format";
import { categoryAllowed, dietaryAllergens, dietaryClaims, firstTimeProducts, matchConfidence, neverBuy } from "./rules/products";
import { deliveryDeadline, deliveryPartial, substitutionPolicy, substitutionPrice } from "./rules/fulfilment";
import { spendPerOrder, spendPerWeek } from "./rules/spend";
import { requestWords } from "./rules/request";
import { auditIntegrity, mandateSignature, mandateValidity, offerExpiry, offerSignature } from "./rules/trust";

/** In RuleId order. */
const RULES: Rule[] = [
  mandateSignature,
  mandateValidity,
  offerSignature,
  offerExpiry,
  auditIntegrity,
  spendPerOrder,
  spendPerWeek,
  categoryAllowed,
  dietaryAllergens,
  dietaryClaims,
  substitutionPolicy,
  substitutionPrice,
  deliveryPartial,
  deliveryDeadline,
  matchConfidence,
  requestWords,
  firstTimeProducts,
  neverBuy,
];

const NO_MANDATE = "Not checked. The mandate is not valid.";
const NO_OFFER = "Not checked. The offer is not valid.";

/** Checks one order against the buyer's mandate. Pure: every input is passed in. */
export function evaluate(input: EvaluateInput): Decision {
  const base: Base = {
    input,
    products: input.products,
    agentId: input.agentId,
    weekSpendNet: input.weekSpendNet,
    orderedProductIds: input.orderedProductIds,
    now: input.now,
    auditLog: input.auditLog,
    heldUntil: input.heldUntil,
    stockTaken: input.stockTaken,
  };
  const mandate = input.mandate.valid ? input.mandate.mandate : undefined;
  const offer = input.offer.valid ? input.offer.offer : undefined;

  const checks = RULES.map((rule): Check => {
    switch (rule.needs) {
      case "nothing":
        return rule.run(base);
      case "mandate":
        return mandate ? rule.run({ ...base, mandate, offer }) : check(rule.id, "skipped", NO_MANDATE);
      case "offer":
        return offer ? rule.run({ ...base, offer }) : check(rule.id, "skipped", NO_OFFER);
      case "both":
        if (!mandate) return check(rule.id, "skipped", NO_MANDATE);
        if (!offer) return check(rule.id, "skipped", NO_OFFER);
        return rule.run({ ...base, mandate, offer });
    }
  });

  return { outcome: outcomeOf(checks), checks };
}

export function outcomeOf(checks: Check[]): Outcome {
  if (checks.some((c) => c.status === "block")) return "blocked";
  if (checks.some((c) => c.status === "ask")) return "needs_approval";
  return "auto_approved";
}
