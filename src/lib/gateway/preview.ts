import type { OfferPreview, SearchHit, SearchRequest, SearchResponse } from "@/lib/contracts";
import { helsinkiDate, nextWorkingDay } from "@/lib/agent/dates";
import { buildLine, isOnTime, quoteLine } from "@/lib/offers/lines";
import { contentPerUnit } from "@/lib/offers/packs";
import type { Market } from "@/lib/offers/types";
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

/**
 * Adds indicative live price and availability to search hits, with one price call and one availability call.
 * A wholesaler outage leaves the hits without previews rather than failing the search.
 */
export async function withPreviews(
  response: SearchResponse,
  request: SearchRequest,
  deps: Pick<Deps, "upstream" | "mandates" | "now">,
): Promise<SearchResponse> {
  if (response.hits.length === 0) return response;
  const ids = response.hits.map((hit) => hit.product.id);
  const deliverBy = request.deliverBy ?? nextWorkingDay(helsinkiDate(deps.now()));
  try {
    const { mandate } = await deps.mandates.current();
    const customer = mandate.buyer.customerNumber;
    const [prices, availability] = await Promise.all([
      deps.upstream.price(ids, deliverBy, customer),
      deps.upstream.availability(ids, deliverBy, customer),
    ]);
    const market: Market = { prices, availability, now: deps.now(), deliverBy };
    return {
      ...response,
      hits: response.hits.map((hit) => {
        const offerPreview = preview(hit, request, market);
        return offerPreview ? { ...hit, offerPreview } : hit;
      }),
    };
  } catch {
    return response;
  }
}
