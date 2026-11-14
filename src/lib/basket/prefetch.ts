import type { Product } from "@/lib/contracts";
import { catalog } from "@/lib/catalog";
import { upstream } from "@/lib/valio";
import { UPSTREAM_ID_CAP } from "@/lib/valio/budget";
import { lineRequest } from "./line";
import type { StoredBasket } from "./types";
import { toQuantity } from "./units";

/** The ids a line's agent will ask about: the best hits of its search, and the closest substitutes of the best one. */
function lineCandidates(basket: StoredBasket, line: StoredBasket["lines"][number]): string[] {
  const parsed = lineRequest(line, basket.deliverBy);
  const index = catalog();
  let best: Product | undefined;
  const ids: string[] = [];
  if (parsed.productId) {
    best = index.get(parsed.productId);
  } else if (parsed.phrase) {
    const hits = index.search({ query: parsed.phrase, limit: UPSTREAM_ID_CAP.search, need: toQuantity(line.request.quantity) }).hits;
    ids.push(...hits.map((hit) => hit.product.id));
    best = hits[0]?.product;
  }
  if (best) ids.push(best.id, ...index.substitutesFor(best.id, UPSTREAM_ID_CAP.quoteLine - 1).map((product) => product.id));
  return ids;
}

/**
 * Asks the wholesaler once for the price and once for the stock of every product the basket's lines will look at,
 * found in the local catalogue, so each line's search and quote are answered from the cache. Never the whole catalogue:
 * at most a search's hits and a quoted line's substitutes per line.
 */
export async function prefetchMarket(basket: StoredBasket, customerNumber: string): Promise<number> {
  const ids = [...new Set(basket.lines.flatMap((line) => lineCandidates(basket, line)))];
  if (ids.length === 0) return 0;
  const client = upstream();
  await Promise.all([client.price(ids, basket.deliverBy, customerNumber), client.availability(ids, basket.deliverBy, customerNumber)]);
  return ids.length;
}
