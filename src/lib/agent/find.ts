import type { Product, SearchResponse } from "@/lib/contracts";
import type { AgentTransport, ParsedRequest } from "./types";

const MAX_CANDIDATES = 5;

export interface Candidates {
  products: Product[];
  confidence: SearchResponse["interpretation"]["confidence"];
  note?: string;
  /** Matches found, before dropping those sold in another unit. */
  matches: number;
}

/** Products that may cover the request, best match first. Uses the wholesaler's own search and interpretation. */
export async function findCandidates(parsed: ParsedRequest, transport: AgentTransport): Promise<Candidates> {
  if (parsed.productId) {
    const product = await transport.getProduct(parsed.productId).catch(() => undefined);
    return { products: product ? [product] : [], confidence: "high", matches: product ? 1 : 0 };
  }
  const response = await transport.searchCatalog({ query: parsed.phrase || parsed.text, limit: 10 });
  const unit = parsed.quantity?.unit;
  const comparable = response.hits
    .map((hit) => hit.product)
    .filter((product) => unit === "sales_unit" || !product.content || product.content.unit === unit);
  return {
    products: comparable.slice(0, MAX_CANDIDATES),
    confidence: response.interpretation.confidence,
    note: response.interpretation.note,
    matches: response.hits.length,
  };
}
