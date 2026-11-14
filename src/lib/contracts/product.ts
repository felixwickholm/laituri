import { z } from "zod";
import { IsoDate, IsoDateTime, Money, Quantity } from "./common";
import { AvailabilityStatus } from "./offer";

export const Temperature = z.enum(["ambient", "chilled", "frozen"]);
export type Temperature = z.infer<typeof Temperature>;

export const PackUnit = z.object({
  unit: z.string().describe("Wholesaler unit code, for example ST (piece), KI (case), PAL (pallet)"),
  gtin: z.string().optional(),
  sizeInBaseUnits: z.number(),
});

export const Allergens = z.object({
  contains: z.array(z.string()),
  mayContain: z.array(z.string()),
  freeFrom: z.array(z.string()),
}).describe("Allergen ids from the allergen vocabulary, for example milk, gluten, nuts");

/** The slim, agent-readable product record built from the wholesaler's product data. */
export const Product = z.object({
  id: z.string().describe("Wholesaler product code"),
  gtin: z.string().optional().describe("GTIN of the sales unit"),
  name: z.object({ en: z.string(), fi: z.string(), sv: z.string().optional() }),
  brand: z.string().optional(),
  vendor: z.string(),
  category: z.string().describe("Wholesaler category code"),
  categoryGroup: z.string().describe("Readable category group id, for example dairy"),
  concept: z.string().optional().describe("Normalised product type, for example milk"),
  origin: z.string().optional().describe("ISO 3166-1 alpha-2 country of origin"),
  salesUnit: z.string(),
  baseUnit: z.string(),
  units: z.array(PackUnit),
  lotSize: z.number().describe("Order quantity step, in sales units"),
  content: z.object({ amount: z.number(), unit: z.enum(["l", "kg"]) }).optional()
    .describe("Net content of one sales unit"),
  temperature: Temperature.optional(),
  allergens: Allergens,
  claims: z.array(z.string()).describe("Dietary and nutrition claims, for example lactose_free, vegan"),
  labels: z.array(z.string()).describe("Certificates and origin labels, for example eu_organic"),
  substitutes: z.array(z.string()).describe("Wholesaler-listed substitute product codes"),
  co2PerKg: z.number().optional().describe("Average kg CO2-eq per kg"),
  deliveryReliability: z.number().optional().describe("Historic delivery reliability, 0 to 1"),
});
export type Product = z.infer<typeof Product>;

export const ProductFilters = z.object({
  claims: z.array(z.string()).optional().describe("Every listed claim must be present"),
  excludeAllergens: z.array(z.string()).optional().describe("Products that contain any of these are removed"),
  labels: z.array(z.string()).optional(),
  categoryGroup: z.string().optional(),
  temperature: Temperature.optional(),
});
export type ProductFilters = z.infer<typeof ProductFilters>;

export const SearchRequest = z.object({
  query: z.string().min(1).max(300).describe("What the buyer needs, in Finnish, Swedish or English"),
  filters: ProductFilters.optional(),
  limit: z.number().int().min(1).max(50).default(10),
  need: Quantity.optional().describe("How much is needed. Adds pack maths and an estimated total to each hit"),
  deliverBy: IsoDate.optional().describe("Latest acceptable delivery date. Defaults to the next working day"),
});
export type SearchRequest = z.infer<typeof SearchRequest>;

export const OfferPreview = z.object({
  unitsNeeded: z.number().optional().describe("Sales units that cover the need, rounded up to the lot size"),
  contentPerUnit: z.object({ amount: z.number(), unit: z.enum(["l", "kg"]) }).optional(),
  unitPrice: Money.describe("Net price per sales unit"),
  comparisonPrice: z.object({ amount: z.number(), per: z.enum(["l", "kg"]) }).optional(),
  estimatedNet: Money.optional().describe("Net total for the need"),
  availability: z.object({
    status: AvailabilityStatus,
    available: z.number().optional().describe("Sales units in stock; absent when the wholesaler tracks no limit"),
    deliveryDate: IsoDate.optional(),
    orderBy: IsoDateTime.optional(),
  }),
  orderable: z.boolean().describe("Can be ordered in full for delivery by the date"),
}).describe("Indicative live price and availability. Only a signed offer from request_quote fixes the price.");
export type OfferPreview = z.infer<typeof OfferPreview>;

export const SearchHit = z.object({
  product: Product,
  score: z.number(),
  matched: z.array(z.string()).describe("Why this product matched"),
  offerPreview: OfferPreview.optional(),
});
export type SearchHit = z.infer<typeof SearchHit>;

export const SearchResponse = z.object({
  query: z.string(),
  interpretation: z.object({
    concept: z.string().optional(),
    claims: z.array(z.string()),
    confidence: z.enum(["high", "medium", "low"]),
    note: z.string().optional().describe("Set when the request is ambiguous; says what to clarify"),
  }),
  hits: z.array(SearchHit),
});
export type SearchResponse = z.infer<typeof SearchResponse>;
