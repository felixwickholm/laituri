import type { Order } from "@/lib/contracts";

/**
 * Stock this workspace's own orders hold, by product and delivery date. The wholesaler's stock figure does not go
 * down when an order is simulated, so every quote and every order subtracts what confirmed orders took and what
 * waiting orders hold while their price hold lasts. A rejected, blocked or lapsed order holds nothing.
 */
export interface StockHolds {
  /** Units held of a tracked product for one delivery date. */
  held(productId: string, deliveryDate: string | undefined): number;
}

function key(productId: string, deliveryDate: string | undefined): string {
  return `${productId}@${deliveryDate ?? "none"}`;
}

/** Until when a waiting order keeps its offer, and so its stock. */
export function holdEnd(order: Pick<Order, "priceHold" | "offer">): string {
  return order.priceHold?.heldUntil ?? order.offer.expiresAt;
}

function holdsStock(order: Order, now: Date): boolean {
  if (order.status === "confirmed") return true;
  return order.status === "pending_approval" && Date.parse(holdEnd(order)) > now.getTime();
}

/** The holds of `orders` at `now`, leaving out the order `exceptId` (the one being decided). */
export function stockHolds(orders: Order[], now: Date, exceptId?: string): StockHolds {
  const units = new Map<string, number>();
  for (const order of orders) {
    if (order.id === exceptId || !holdsStock(order, now)) continue;
    for (const line of order.offer.lines) {
      if (line.quantity <= 0 || line.availability.stock !== "tracked") continue;
      const at = key(line.productId, line.availability.deliveryDate);
      units.set(at, (units.get(at) ?? 0) + line.quantity);
    }
  }
  return { held: (productId, deliveryDate) => units.get(key(productId, deliveryDate)) ?? 0 };
}
