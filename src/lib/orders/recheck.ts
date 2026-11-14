import type { Decision, Order } from "@/lib/contracts";
import { orderedProductIds, productsFor, weekSpendNet } from "./context";
import { readOffer, singleUse } from "./read-offer";
import { stockTakenAtApproval } from "./stock";
import type { OfferRead, OrderDeps } from "./types";

/** The signed copy the wholesaler kept, verified again, and only if it is the offer the order carries. */
async function storedOffer(order: Order, deps: OrderDeps): Promise<OfferRead> {
  const signed = await deps.store.offers.get(order.offer.id);
  if (!signed) return { valid: false, offer: order.offer, reason: "The signed offer is no longer on record." };
  const read = await readOffer(signed.jws, deps);
  if (read.valid && (await deps.hash(read.offer)) !== (await deps.hash(order.offer))) {
    return { valid: false, offer: order.offer, reason: "The order no longer carries the offer the wholesaler signed." };
  }
  return read;
}

/**
 * Evaluates a waiting order again against the mandate in force now, as at placement: the buyer may have changed
 * the mandate while the order waited. Other orders count as they stand now; this one is left out of them. The offer
 * holds until the price hold ends, and stock is asked from the wholesaler again.
 */
export async function recheckOrder(order: Order, deps: OrderDeps, now: Date): Promise<Decision> {
  const { jws } = await deps.mandates.current(order.buyer.id);
  const others = (await deps.store.orders.list()).filter((other) => other.id !== order.id);
  const stockTaken = await stockTakenAtApproval(order, others, deps, now);
  return deps.policy.evaluate({
    mandate: await deps.mandates.read(jws),
    offer: singleUse(await storedOffer(order, deps), others),
    products: productsFor(order.offer, deps),
    agentId: order.agent.id,
    weekSpendNet: weekSpendNet(others, order.buyer.id, now),
    orderedProductIds: orderedProductIds(others, order.buyer.id),
    now,
    auditLog: await deps.audit.verify(),
    ...(order.priceHold ? { heldUntil: order.priceHold.heldUntil } : {}),
    ...(stockTaken ? { stockTaken } : {}),
  });
}
