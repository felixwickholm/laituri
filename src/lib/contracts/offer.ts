import { z } from "zod";
import { IsoDate, IsoDateTime, Jws, Money, Quantity } from "./common";
import { ProductFacts } from "./facts";
import { RequestCheck } from "./request-check";

export const QuoteLineRequest = z.object({
  productId: z.string(),
  quantity: Quantity.describe("Use l or kg to let the wholesaler convert to sales units"),
});

export const QuoteRequest = z.object({
  lines: z.array(QuoteLineRequest).min(1).max(50),
  deliverBy: IsoDate.describe("Latest acceptable delivery date"),
  intent: z.string().max(500).optional().describe("The buyer's original words, kept for the audit trail"),
  matchConfidence: z.enum(["high", "medium", "low"]).optional(),
});
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const AvailabilityStatus = z.enum(["available", "partial", "unavailable", "cutoff_passed", "blocked"]);
export type AvailabilityStatus = z.infer<typeof AvailabilityStatus>;

export const SubstitutionTier = z.enum(["good", "better", "best"]);

export const OfferLine = z.object({
  productId: z.string(),
  gtin: z.string().optional(),
  name: z.string(),
  categoryGroup: z.string(),
  quantity: z.number().describe("Quantity in sales units"),
  salesUnit: z.string(),
  content: z.object({ amount: z.number(), unit: z.enum(["l", "kg"]) }).optional()
    .describe("Total net content of this line"),
  unitPrice: Money.describe("Fixed net price per sales unit"),
  comparisonPrice: z.object({ amount: z.number(), per: z.enum(["l", "kg"]) }).optional(),
  taxRate: z.number(),
  lineNet: Money,
  availability: z.object({
    status: AvailabilityStatus,
    requested: z.number().describe("Sales units needed to cover the request"),
    available: z.number().optional()
      .describe("Sales units the wholesaler counts in stock; absent when stock is untracked, because no count stands behind it"),
    stock: z.enum(["tracked", "untracked"]).optional()
      .describe("untracked: the wholesaler keeps no stock count for this product, so the offered quantity is not checked against stock. " +
        "Absent only on offers signed before this field was added"),
    deliveryDate: IsoDate.optional(),
    orderBy: IsoDateTime.optional().describe("Order cut-off for that delivery date"),
    logisticModel: z.enum(["Stock", "Terminal"]).optional(),
  }),
  facts: ProductFacts.optional()
    .describe("What the wholesaler vouches for about this product, signed with the offer. Absent only on offers signed before these facts were added"),
  substituteFor: z.object({
    productId: z.string(),
    name: z.string(),
    reason: z.string(),
    likeForLike: z.boolean(),
    priceChangePct: z.number(),
  }).optional(),
});
export type OfferLine = z.infer<typeof OfferLine>;

export const Fulfilment = z.enum(["full", "partial", "substituted", "late", "unavailable"]);
export type Fulfilment = z.infer<typeof Fulfilment>;

/** A fixed-price offer. The wholesaler signs it, so the agent can verify price and stock claims offline. */
export const Offer = z.object({
  id: z.string(),
  issuer: z.string(),
  customerNumber: z.string(),
  buyer: z.object({ id: z.string(), name: z.string() }).describe("The buyer the offer was made for; only that buyer's mandate can order it"),
  issuedAt: IsoDateTime,
  expiresAt: IsoDateTime,
  intent: z.string().optional(),
  matchConfidence: z.enum(["high", "medium", "low"]),
  deliverBy: IsoDate,
  deliveryDate: IsoDate.optional().describe("Date all lines arrive"),
  orderBy: IsoDateTime.optional().describe("Earliest cut-off across the lines"),
  fulfilment: Fulfilment,
  lines: z.array(OfferLine),
  totals: z.object({ net: Money, tax: Money, gross: Money }),
  notes: z.array(z.string()).describe("Plain-language exceptions, for example a passed cut-off"),
  requestCheck: z.array(RequestCheck).optional().describe(
    "The wholesaler's comparison of the buyer's words (intent) with this offer, one entry per requirement, signed with the offer. " +
      "Absent when no words were sent",
  ),
  source: z.object({
    system: z.string(),
    pricedAt: IsoDateTime,
  }),
});
export type Offer = z.infer<typeof Offer>;

export const SignedOffer = z.object({ offer: Offer, jws: Jws });
export type SignedOffer = z.infer<typeof SignedOffer>;

export const Alternative = z.object({
  tier: SubstitutionTier,
  meaning: z.string().describe("One sentence: what this tier stands for, the same for every alternative of the tier"),
  tradeoff: z.string().describe("One sentence: what changes compared with the request"),
  signed: SignedOffer,
});
export type Alternative = z.infer<typeof Alternative>;

export const QuoteResponse = z.object({
  primary: SignedOffer.describe("The request as asked, with honest availability"),
  alternatives: z.array(Alternative).describe("Ranked ways to cover the full need when the primary cannot"),
});
export type QuoteResponse = z.infer<typeof QuoteResponse>;
