import { z } from "zod";

export const Money = z.object({
  amount: z.number().describe("Decimal amount, two-decimal precision"),
  currency: z.literal("EUR"),
});
export type Money = z.infer<typeof Money>;

/** How a buyer expresses how much they need. */
export const QuantityUnit = z.enum(["l", "kg", "sales_unit"]);
export type QuantityUnit = z.infer<typeof QuantityUnit>;

export const Quantity = z.object({
  amount: z.number().positive(),
  unit: QuantityUnit,
});
export type Quantity = z.infer<typeof Quantity>;

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Calendar date, YYYY-MM-DD");
export const IsoDateTime = z.string().describe("ISO 8601 timestamp with offset");

/** A compact JWS (EdDSA). The payload is the signed object. */
export const Jws = z.string().describe("Compact JWS, EdDSA, verifiable against the issuer's published JWKS");
export type Jws = z.infer<typeof Jws>;
