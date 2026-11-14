import type { Offer, Order, Product } from "@/lib/contracts";
import { confirmedNetInWeek } from "@/lib/policy/week";
import type { OrderDeps } from "./types";

function confirmedFor(orders: Order[], buyerId: string): Order[] {
  return orders.filter((order) => order.status === "confirmed" && order.buyer.id === buyerId);
}

/** Net spend of this buyer's confirmed orders in the buyer's ISO week of `now`. */
export function weekSpendNet(orders: Order[], buyerId: string, now: Date): number {
  return confirmedNetInWeek(confirmedFor(orders, buyerId), now);
}

export function orderedProductIds(orders: Order[], buyerId: string): Set<string> {
  return new Set(confirmedFor(orders, buyerId).flatMap((order) => order.offer.lines.map((line) => line.productId)));
}

export function productsFor(offer: Offer, deps: Pick<OrderDeps, "catalog">): Map<string, Product> {
  const products = new Map<string, Product>();
  for (const line of offer.lines) {
    const product = deps.catalog.get(line.productId);
    if (product) products.set(product.id, product);
  }
  return products;
}
