import type { OfferLine, OfferPreview, QuoteResponse, SearchResponse } from "@/lib/contracts";
import type { DemandOutcome } from "./types";

export interface Assessment {
  outcome: DemandOutcome;
  lostNet?: number;
}

const cents = (amount: number) => Math.round(amount * 100) / 100;

function positive(amount: number): number | undefined {
  return amount > 0 ? cents(amount) : undefined;
}

/** Net value of the units asked for but not offered, at the offered unit price. */
function shortfall(lines: OfferLine[]): number | undefined {
  return positive(lines.reduce((sum, line) => sum + Math.max(0, line.availability.requested - line.quantity) * line.unitPrice.amount, 0));
}

/** How a quote answered the request. A request only an alternative covers was still met, though not as asked. */
export function assessQuote(response: QuoteResponse): Assessment {
  const { offer } = response.primary;
  if (offer.fulfilment === "full") return { outcome: offer.matchConfidence === "low" ? "low_confidence" : "met_in_full" };
  if (response.alternatives.length > 0) return { outcome: "met_with_alternative" };
  const cutoff = offer.lines.some((line) => line.availability.status === "cutoff_passed");
  return { outcome: cutoff ? "cutoff_passed" : "short_stock", lostNet: shortfall(offer.lines) };
}

function previewShortfall(preview: OfferPreview, cutoff: boolean): number | undefined {
  if (preview.unitsNeeded === undefined) return undefined;
  const available = cutoff ? 0 : preview.availability.available ?? 0;
  return positive(Math.max(0, preview.unitsNeeded - available) * preview.unitPrice.amount);
}

/**
 * How a search answered the request. Hits without live previews count as met: the catalogue has the product.
 * With previews, the request is met when any hit can be ordered in full on time; otherwise the best hit says why not.
 */
export function assessSearch(response: SearchResponse): Assessment {
  if (response.hits.length === 0) return { outcome: "not_found" };
  if (response.interpretation.confidence === "low") return { outcome: "low_confidence" };
  const previews = response.hits.flatMap((hit) => (hit.offerPreview ? [hit.offerPreview] : []));
  if (previews.length === 0 || previews.some((preview) => preview.orderable)) return { outcome: "met_in_full" };
  const [best] = previews;
  const cutoff = best.availability.status === "cutoff_passed";
  return { outcome: cutoff ? "cutoff_passed" : "short_stock", lostNet: previewShortfall(best, cutoff) };
}
