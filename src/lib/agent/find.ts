import type { Product, SearchHit, SearchResponse } from "@/lib/contracts";
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

/** Products that may cover the request, best match first. Uses the wholesaler's own search and interpretation. */
export async function findCandidates(parsed: ParsedRequest, transport: AgentTransport): Promise<Candidates> {
  if (parsed.productId) {
    const product = await transport.getProduct(parsed.productId).catch(() => undefined);
    const products = product ? [product] : [];
    return { products, hits: [], confidence: "high", matches: products.length };
  }
  const response = await transport.searchCatalog({
    query: parsed.phrase || parsed.text,
    limit: 10,
    need: parsed.quantity,
    deliverBy: parsed.deliverBy,
  });
  const unit = parsed.quantity?.unit;
  const hits = response.hits.filter(
    ({ product }) => unit === "sales_unit" || !product.content || product.content.unit === unit,
  );
  return {
    products: hits.slice(0, MAX_CANDIDATES).map((hit) => hit.product),
    hits,
    confidence: response.interpretation.confidence,
    note: response.interpretation.note,
    matches: response.hits.length,
  };
}
