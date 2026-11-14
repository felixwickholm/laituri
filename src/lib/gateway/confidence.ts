import type { QuoteRequest } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";

type Confidence = NonNullable<QuoteRequest["matchConfidence"]>;

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * How well the quoted products match what the buyer asked for. The agent may state a confidence,
 * but the wholesaler checks the buyer's words against its own catalogue and never reports more than it finds.
 * Without the buyer's words there is nothing to check, so the match is at most medium.
 */
export function matchConfidence(request: QuoteRequest, catalog: Pick<Catalog, "get" | "search">): Confidence {
  const claimed = request.matchConfidence ?? "high";
  const found = request.intent ? fromIntent(request, request.intent, catalog) : "medium";
  return RANK[found] < RANK[claimed] ? found : claimed;
}

function fromIntent(request: QuoteRequest, intent: string, catalog: Pick<Catalog, "get" | "search">): Confidence {
  const result = catalog.search({ query: intent.slice(0, 300), limit: 50 });
  const hitIds = new Set(result.hits.map((hit) => hit.product.id));
  const concept = result.interpretation.concept;
  const matches = request.lines.every((line) => {
    if (hitIds.has(line.productId)) return true;
    return concept !== undefined && catalog.get(line.productId)?.concept === concept;
  });
  return matches ? result.interpretation.confidence : "low";
}
