import { z } from "zod";
import { IsoDateTime, Money } from "./common";

export const SubstitutionPolicy = z.enum(["none", "like_for_like", "any_within_rules"]);
export type SubstitutionPolicy = z.infer<typeof SubstitutionPolicy>;

/**
 * The standing authority a buyer gives its purchasing agent.
 * The buyer signs it; the wholesaler checks every order against it.
 */
export const Mandate = z.object({
  id: z.string(),
  version: z.number().int(),
  buyer: z.object({
    id: z.string().describe("Buyer organisation id"),
    name: z.string(),
    customerNumber: z.string().describe("Customer number at the wholesaler"),
  }),
  agent: z.object({ id: z.string(), name: z.string() }),
  supplier: z.string(),
  validFrom: IsoDateTime,
  validUntil: IsoDateTime,
  limits: z.object({
    perOrder: Money.describe("Largest order (net) the agent may place alone"),
    perWeek: Money.describe("Total net spend the agent may commit in one ISO week"),
  }),
  categories: z.object({
    allowed: z.array(z.string()).describe("Category groups the agent may buy from"),
  }),
  dietary: z.object({
    excludeAllergens: z.array(z.string()).describe("Hard rule: never buy products that contain these"),
    blockMayContain: z.boolean().describe("Treat 'may contain' as 'contains'"),
    requiredClaims: z.array(z.string()).describe("Hard rule: every product must carry these claims"),
  }),
  substitution: z.object({
    policy: SubstitutionPolicy,
    maxPriceIncreasePct: z.number().min(0),
  }),
  delivery: z.object({
    allowPartial: z.boolean(),
    maxDelayDays: z.number().int().min(0),
  }),
  approval: z.object({
    approver: z.object({ id: z.string(), name: z.string() }),
    firstTimeProducts: z.boolean().describe("Ask a human before the first order of a product"),
  }),
});
export type Mandate = z.infer<typeof Mandate>;
