import { z } from "zod";

export const RuleId = z.enum([
  "mandate.signature",
  "mandate.validity",
  "offer.signature",
  "offer.expiry",
  "audit.integrity",
  "spend.per_order",
  "spend.per_week",
  "category.allowed",
  "dietary.allergens",
  "dietary.claims",
  "substitution.policy",
  "substitution.price",
  "delivery.partial",
  "delivery.deadline",
  "match.confidence",
  "request.words",
  "product.first_time",
]);
export type RuleId = z.infer<typeof RuleId>;

/** pass: inside the mandate. ask: a human must sign off. block: nobody can approve this through the agent channel. */
/** skipped: the rule could not run because the mandate or the offer is not valid. */
export const CheckStatus = z.enum(["pass", "ask", "block", "skipped"]);
export type CheckStatus = z.infer<typeof CheckStatus>;

export const Check = z.object({
  rule: RuleId,
  status: CheckStatus,
  message: z.string().describe("One short sentence a buyer understands"),
  observed: z.string().optional(),
  limit: z.string().optional(),
});
export type Check = z.infer<typeof Check>;

export const Outcome = z.enum(["auto_approved", "needs_approval", "blocked"]);
export type Outcome = z.infer<typeof Outcome>;

export const Decision = z.object({
  outcome: Outcome,
  checks: z.array(Check).describe("Every rule that was evaluated, including the ones that passed"),
});
export type Decision = z.infer<typeof Decision>;
