import { z } from "zod";

/** What the wholesaler vouches for about a product, from its own product data. Signed when it is part of an offer. */
export const ProductFacts = z.object({
  countryOfOrigin: z.string().optional().describe("ISO 3166-1 alpha-2 country of origin, as the wholesaler records it"),
  labels: z.array(z.string()).describe("Certificates and origin labels on the product, for example organic, msc or finnish_origin"),
  deliveryReliability: z.number().optional()
    .describe("Share of past deliveries of this product that arrived in full and on time, 0 to 1"),
  categoryAverageCo2PerKg: z.number().optional()
    .describe("Average kg CO2-eq per kg for the product's category. A category average, not a measurement of this product"),
});
export type ProductFacts = z.infer<typeof ProductFacts>;

/** How search ranks products that all match the request clearly. */
export const SearchPreference = z.enum(["price", "reliability", "sustainability"]);
export type SearchPreference = z.infer<typeof SearchPreference>;
