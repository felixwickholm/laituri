import type { Offer, OfferLine, OfferPreview, Quantity, QuoteResponse, SearchHit, SignedOffer } from "@/lib/contracts";

/** Price per litre, kg or unit, as the buyer counts the need. Undefined when it cannot be compared. */
export function pricePerNeedUnit(line: OfferLine, unit: Quantity["unit"]): number | undefined {
  if (unit === "sales_unit") return line.unitPrice.amount || undefined;
  if (line.comparisonPrice?.per === unit && line.comparisonPrice.amount > 0) return line.comparisonPrice.amount;
  if (line.content?.unit === unit && line.content.amount > 0 && line.quantity > 0) {
    return line.lineNet.amount / line.content.amount;
  }
  return undefined;
}

/** Delivered in full, by the date asked. */
export function lineOnTime(line: OfferLine, deliverBy: string): boolean {
  const { status, deliveryDate } = line.availability;
  return status === "available" && line.quantity > 0 && (!deliveryDate || deliveryDate <= deliverBy);
}

export function offerOnTime(offer: Offer): boolean {
  if (offer.fulfilment !== "full" && offer.fulfilment !== "substituted") return false;
  return offer.lines.every((line) => lineOnTime(line, offer.deliverBy));
}

/** Every line can be ordered in full; only the date is later than asked. */
export function offerOnlyLate(offer: Offer): boolean {
  return offer.fulfilment === "late" && offer.lines.every((line) => line.availability.status === "available" && line.quantity > 0);
}

export interface Ranked {
  line: OfferLine;
  price: number;
}

/** Comparable lines, cheapest first. */
export function rankByPrice(lines: OfferLine[], unit: Quantity["unit"]): Ranked[] {
  return lines
    .map((line) => ({ line, price: pricePerNeedUnit(line, unit) }))
    .filter((ranked): ranked is Ranked => ranked.price !== undefined)
    .sort((a, b) => a.price - b.price || a.line.productId.localeCompare(b.line.productId));
}

const TIER_ORDER = { good: 0, better: 1, best: 2 } as const;

/** The first signed alternative, good before better before best, that covers the need on time. */
export function pickAlternative(response: QuoteResponse): { signed: SignedOffer; tradeoff: string } | undefined {
  const alternative = [...response.alternatives]
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
    .find((alt) => offerOnTime(alt.signed.offer));
  return alternative ? { signed: alternative.signed, tradeoff: alternative.tradeoff } : undefined;
}

export interface RankedHit {
  hit: SearchHit;
  preview: OfferPreview;
  price: number;
}

/** Indicative price per litre, kg or unit from a search preview. */
export function previewPrice(preview: OfferPreview, need: Quantity): number | undefined {
  if (need.unit === "sales_unit") return preview.unitPrice.amount || undefined;
  if (preview.comparisonPrice?.per === need.unit && preview.comparisonPrice.amount > 0) return preview.comparisonPrice.amount;
  if (preview.estimatedNet && need.amount > 0) return preview.estimatedNet.amount / need.amount;
  return undefined;
}

/** Hits with a comparable preview, cheapest first. */
export function rankHits(hits: SearchHit[], need: Quantity): RankedHit[] {
  return hits
    .flatMap((hit) => {
      const price = hit.offerPreview ? previewPrice(hit.offerPreview, need) : undefined;
      return hit.offerPreview && price !== undefined ? [{ hit, preview: hit.offerPreview, price }] : [];
    })
    .sort((a, b) => a.price - b.price || a.hit.product.id.localeCompare(b.hit.product.id));
}
