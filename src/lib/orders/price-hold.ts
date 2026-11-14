import type { Order, PriceHold } from "@/lib/contracts";
import { TOKEN_TYPE } from "@/lib/trust/types";
import type { OrderDeps } from "./types";

/**
 * How long the wholesaler keeps an offer's price while a person decides: until the order cut-off for its delivery
 * date, never past it. An offer without a cut-off keeps its own expiry.
 */
export function holdUntil(order: Pick<Order, "offer">): string {
  const { orderBy, expiresAt } = order.offer;
  return orderBy && Date.parse(orderBy) > Date.parse(expiresAt) ? orderBy : expiresAt;
}

/** The wholesaler's signed statement that the price holds until then, bound to the order and the exact offer. */
export async function signPriceHold(order: Order, deps: Pick<OrderDeps, "trust" | "hash" | "now">): Promise<PriceHold> {
  const heldUntil = holdUntil(order);
  const payload = {
    type: "price_hold",
    orderId: order.id,
    offerId: order.offer.id,
    offerHash: await deps.hash(order.offer),
    heldUntil,
    issuedAt: deps.now().toISOString(),
  };
  return { heldUntil, jws: await deps.trust.sign("supplier", payload, TOKEN_TYPE.priceHold) };
}
