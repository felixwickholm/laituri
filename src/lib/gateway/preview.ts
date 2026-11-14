import type { OfferPreview, SearchHit, SearchRequest, SearchResponse } from "@/lib/contracts";
import { helsinkiDate, nextWorkingDay } from "@/lib/agent/dates";
import { buildLine, isOnTime, quoteLine } from "@/lib/offers/lines";
import { marketOf } from "@/lib/offers/market";
import { contentPerUnit } from "@/lib/offers/packs";
import type { Market } from "@/lib/offers/types";
import { UPSTREAM_ID_CAP } from "@/lib/valio/budget";
import { bestBuyFirst } from "./ranking";
import type { Deps } from "./types";

function preview(hit: SearchHit, request: SearchRequest, market: Market): OfferPreview | undefined {
  const { product } = hit;
  const price = market.prices.get(product.id);
  const stock = market.availability.get(product.id);
  if (!price?.found || price.net === undefined) return undefined;
  // Without a need, one lot shows whether the product can be ordered at all.
  const built = request.need
    ? quoteLine(product.id, product, request.need, market)
    : buildLine(product.id, product, product.lotSize > 0 ? product.lotSize : 1, market);
  const { line } = built;
  const unitsNeeded = request.need && line.availability.requested > 0 ? line.availability.requested : undefined;
  return {
    unitsNeeded,
    contentPerUnit: contentPerUnit(product, price),
    unitPrice: line.unitPrice,
    comparisonPrice: line.comparisonPrice,
    estimatedNet: unitsNeeded === undefined ? undefined : { amount: Math.round(unitsNeeded * price.net * 100) / 100, currency: "EUR" },
    availability: {
      status: line.availability.status,
      available: stock && Number.isFinite(stock.available) ? Math.max(0, stock.available) : undefined,
      deliveryDate: stock?.availableDate,
      orderBy: stock?.orderBy,
    },
    orderable: isOnTime(line, market.deliverBy),
  };
}

async function previewed(
  hits: SearchHit[],
  request: SearchRequest,
  deps: Pick<Deps, "upstream" | "mandates" | "now" | "store">,
  buyerId?: string,
): Promise<SearchHit[]> {
  // Only the best hits are asked about; the rest keep no preview rather than send the wholesaler a long list.
  const ids = hits.slice(0, UPSTREAM_ID_CAP.search).map((hit) => hit.product.id);
  const deliverBy = request.deliverBy ?? nextWorkingDay(helsinkiDate(deps.now()));
  try {
    const { mandate } = await deps.mandates.current(buyerId);
    const customer = mandate.buyer.customerNumber;
    const [prices, availability] = await Promise.all([
      deps.upstream.price(ids, deliverBy, customer),
      deps.upstream.availability(ids, deliverBy, customer),
    ]);
    const market = marketOf(prices, availability, await deps.store.orders.list(), deps.now(), deliverBy);
    return hits.map((hit) => {
      const offerPreview = preview(hit, request, market);
      return offerPreview ? { ...hit, offerPreview } : hit;
    });
  } catch {
    return hits;
  }
}

/**
 * Adds indicative live price and availability to the best search hits, at most UPSTREAM_ID_CAP.search of them, with one
 * price call and one availability call,
 * at the prices of the given buyer (the primary buyer when none is given).
 * A wholesaler outage leaves the hits without previews rather than failing the search.
 * Only a clear match is reordered by the buyer's preference; an uncertain one keeps its relevance order.
 */
export async function withPreviews(
  response: SearchResponse,
  request: SearchRequest,
  deps: Pick<Deps, "upstream" | "mandates" | "now" | "store">,
  buyerId?: string,
): Promise<SearchResponse> {
  if (response.hits.length === 0) return response;
  const hits = await previewed(response.hits, request, deps, buyerId);
  return { ...response, hits: response.interpretation.confidence === "high" ? bestBuyFirst(hits, request.prefer) : hits };
}
