import type { Product, QuoteRequest } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import { now } from "@/lib/clock";
import { readBuyerWords, unexplainedWords, type BuyerWords } from "@/lib/request";

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

/** The product is the one the words name: found by the search or of the named type, with every claim, and no word left unexplained. */
function fits(product: Product | undefined, words: BuyerWords, found: { ids: Set<string>; concept?: string }): boolean {
  if (!product) return false;
  const named = found.ids.has(product.id) || (found.concept !== undefined && product.concept === found.concept);
  return named && words.claims.every((claim) => product.claims.includes(claim)) && unexplainedWords(words, product).length === 0;
}

function fromIntent(request: QuoteRequest, intent: string, catalog: Pick<Catalog, "get" | "search">): Confidence {
  // The buyer's words usually carry a quantity and a date; only the product words are matched.
  const words = readBuyerWords(intent, now());
  if (!/\p{L}{3,}/u.test(words.phrase)) return "medium";
  const result = catalog.search({ query: words.phrase.slice(0, 300), limit: 50 });
  const found = { ids: new Set(result.hits.map((hit) => hit.product.id)), concept: result.interpretation.concept };
  return request.lines.every((line) => fits(catalog.get(line.productId), words, found)) ? result.interpretation.confidence : "low";
}
