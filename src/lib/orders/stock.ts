import type { Offer, OfferLine, Order } from "@/lib/contracts";
import { UpstreamError } from "@/lib/gateway/errors";
import { count, day } from "@/lib/offers/format";
import { stockHolds } from "@/lib/offers/reservations";
import { STOCK_TAKEN } from "@/lib/policy/rules/trust";
import type { OrderDeps } from "./types";

/** Lines that deliver a product whose stock the wholesaler counts. */
function trackedLines(offer: Offer): OfferLine[] {
  return offer.lines.filter((line) => line.quantity > 0 && line.availability.stock === "tracked");
}

function shortfall(line: OfferLine, left: number): string {
  const when = line.availability.deliveryDate ? ` for ${day(line.availability.deliveryDate)}` : "";
  return `Only ${count(Math.max(0, left))} units of ${line.name} are left${when} after this workspace's other orders, ` +
    `not the ${count(line.quantity)} offered. Ask for a new quote.`;
}

/**
 * At placement: the wholesaler's count when the offer was signed (what it showed plus what other orders held then)
 * must still cover this order after what this workspace's orders hold now. Undefined when it does.
 */
export function stockTakenSinceQuote(offer: Offer, orders: Order[], now: Date): string | undefined {
  const holds = stockHolds(orders, now);
  for (const line of trackedLines(offer)) {
    const { available, reserved = 0, deliveryDate } = line.availability;
    if (available === undefined) continue;
    const left = available + reserved - holds.held(line.productId, deliveryDate);
    if (line.quantity > left) return shortfall(line, left);
  }
  return undefined;
}

/**
 * At approval: the wholesaler's count now, asked again, less what this workspace's other orders hold. A waiting order
 * may have sat for hours, so the stock it was offered is not taken on trust.
 */
export async function stockTakenAtApproval(order: Order, others: Order[], deps: Pick<OrderDeps, "upstream">, now: Date): Promise<string | undefined> {
  const lines = trackedLines(order.offer);
  if (lines.length === 0) return undefined;
  let fresh;
  try {
    fresh = await deps.upstream.availability(lines.map((line) => line.productId), order.offer.deliverBy, order.offer.customerNumber);
  } catch {
    throw new UpstreamError("The wholesaler's stock service did not answer, so the order cannot be approved yet. Try again in a minute.");
  }
  const holds = stockHolds(others, now);
  for (const line of lines) {
    const counted = fresh.get(line.productId)?.available ?? 0;
    if (!Number.isFinite(counted)) continue;
    const left = counted - holds.held(line.productId, line.availability.deliveryDate);
    if (line.quantity > left) return shortfall(line, left);
  }
  return undefined;
}

/** True when a re-check found that the stock the offer counted on is gone, so fresh alternatives are worth offering. */
export function stockWasTaken(order: Order): boolean {
  return order.decision.checks.some((check) => check.rule === "offer.expiry" && check.status === "block" && check.observed === STOCK_TAKEN);
}
