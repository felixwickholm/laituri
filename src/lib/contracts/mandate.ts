import { z } from "zod";
import { IsoDateTime, Money } from "./common";

/** One product the buyer never wants bought, named so a person can read the list without the catalogue. */
export const NeverBuyProduct = z.object({
  productId: z.string().describe("Wholesaler product code"),
  name: z.string().describe("The product's name when it was added"),
});
export type NeverBuyProduct = z.infer<typeof NeverBuyProduct>;

/** The buyer's never-buy list: named products, and words matched against product names (for example "palm oil"). */
export const NeverBuy = z.object({
  products: z.array(NeverBuyProduct).max(200).describe("Hard rule: never buy these products"),
  words: z.array(z.string().trim().min(2).max(60)).max(50).default([])
    .describe("Hard rule: never buy a product whose name contains one of these words, in any language the catalogue names it"),
});
export type NeverBuy = z.infer<typeof NeverBuy>;

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
    neverBuy: NeverBuy.optional()
      .describe("Hard rule: products and name words the agent never buys, swaps to or plans with. Absent means an empty list."),
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
    requireRequestWords: z.boolean().default(true)
      .describe("Send an order to the approver when its offer carries no buyer's words, so it could not be checked against them"),
  }),
});
export type Mandate = z.infer<typeof Mandate>;
