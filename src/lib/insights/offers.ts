import type { Order, SignedOffer } from "@/lib/contracts";
import { median } from "./median";
import type { OfferStats } from "./types";

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
