import type { Order, SignedOffer } from "@/lib/contracts";
import type { OfferStats } from "./types";

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Every signed offer, primary or alternative, and what became of it. An offer is ordered once an order names it. */
export function offerStats(offers: SignedOffer[], orders: Order[], now: Date): OfferStats {
  const firstOrder = new Map<string, Order>();
  for (const order of [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!firstOrder.has(order.offer.id)) firstOrder.set(order.offer.id, order);
  }
  let ordered = 0;
  let expiredUnused = 0;
  const waits: number[] = [];
  for (const { offer } of offers) {
    const order = firstOrder.get(offer.id);
    if (order) {
      ordered += 1;
      waits.push((Date.parse(order.createdAt) - Date.parse(offer.issuedAt)) / 1000);
    } else if (Date.parse(offer.expiresAt) <= now.getTime()) {
      expiredUnused += 1;
    }
  }
  const signed = offers.length;
  const wait = median(waits);
  return {
    signed,
    ordered,
    expiredUnused,
    open: signed - ordered - expiredUnused,
    conversionRate: signed ? Math.round((ordered / signed) * 1000) / 1000 : 0,
    ...(wait !== undefined ? { medianSecondsToOrder: Math.round(wait) } : {}),
  };
}
