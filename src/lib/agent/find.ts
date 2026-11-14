import type { Mandate, Product, SearchHit, SearchResponse } from "@/lib/contracts";
import type { AgentTransport, ParsedRequest } from "./types";

const MAX_CANDIDATES = 5;

export interface Candidates {
  /** Best match first, at most five. */
  products: Product[];
  /** Every comparable hit, with the wholesaler's indicative price and stock when it gave them. */
  hits: SearchHit[];
  confidence: SearchResponse["interpretation"]["confidence"];
  note?: string;
  /** Matches found, before dropping those sold in another unit. */
  matches: number;
}

/** The allergens a mandate rules out, and whether a trace of one rules a product out too. */
export type DietaryExclusions = Pick<Mandate["dietary"], "excludeAllergens" | "blockMayContain">;

function safeFor(product: Product, dietary?: DietaryExclusions): boolean {
  if (!dietary?.excludeAllergens.length) return true;
  const { contains, mayContain } = product.allergens;
  if (dietary.excludeAllergens.some((allergen) => contains.includes(allergen))) return false;
  return !(dietary.blockMayContain && dietary.excludeAllergens.some((allergen) => mayContain.includes(allergen)));
}

/**
 * Products that may cover the request, best match first. Uses the wholesaler's own search and interpretation. With the
 * mandate's exclusions, the search leaves out what the buyer can never have, a trace too when the mandate says so,
 * so a school that excludes sesame finds the sesame-free ciabatta rather than one it can only be refused.
 * A product code the caller named is looked up as it is: the mandate still decides on it.
 */
export async function findCandidates(parsed: ParsedRequest, transport: AgentTransport, dietary?: DietaryExclusions): Promise<Candidates> {
  if (parsed.productId) {
    const product = await transport.getProduct(parsed.productId).catch(() => undefined);
    const products = product ? [product] : [];
    return { products, hits: [], confidence: "high", matches: products.length };
  }
  const excluded = dietary?.excludeAllergens ?? [];
  const response = await transport.searchCatalog({
    query: parsed.phrase || parsed.text,
    limit: 10,
    need: parsed.quantity,
    deliverBy: parsed.deliverBy,
    ...(excluded.length ? { filters: { excludeAllergens: excluded } } : {}),
  });
  const unit = parsed.quantity?.unit;
  const hits = response.hits.filter(
    ({ product }) => (unit === "sales_unit" || !product.content || product.content.unit === unit) && safeFor(product, dietary),
  );
  return {
    products: hits.slice(0, MAX_CANDIDATES).map((hit) => hit.product),
    hits,
    confidence: response.interpretation.confidence,
    note: response.interpretation.note,
    matches: response.hits.length,
  };
}
