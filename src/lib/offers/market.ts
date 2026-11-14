import type { Order } from "@/lib/contracts";
import type { UpstreamAvailability, UpstreamPrice } from "@/lib/valio/types";
import { stockHolds } from "./reservations";
import type { Market } from "./types";

/**
 * The wholesaler's answers as one quote sees them: tracked stock less what this workspace's own confirmed and
 * waiting orders hold for the same delivery date. Untracked stock has no count to subtract from.
 */
export function marketOf(
  prices: Map<string, UpstreamPrice>,
  upstream: Map<string, UpstreamAvailability>,
  orders: Order[],
  now: Date,
  deliverBy: string,
): Market {
  const holds = stockHolds(orders, now);
  const availability = new Map<string, UpstreamAvailability>();
  const held = new Map<string, number>();
  for (const [id, stock] of upstream) {
    const units = Number.isFinite(stock.available) ? holds.held(id, stock.availableDate) : 0;
    held.set(id, units);
    availability.set(id, units > 0 ? { ...stock, available: Math.max(0, stock.available - units) } : stock);
  }
  return { prices, availability, held, now, deliverBy };
}
