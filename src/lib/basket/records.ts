import type { Basket } from "@/lib/contracts";
import { NotFoundError } from "@/lib/gateway/errors";
import { currentMandate } from "@/lib/mandate";
import { store } from "@/lib/store";
import { settleLine } from "./settle";
import type { StoredBasket } from "./types";
import { toBasket } from "./view";

/**
 * Brings the lines of a finished basket up to date with their orders: a waiting order a person approved or rejected
 * elsewhere (the approvals screen, the phone, the API) settles its line, as if decided in the basket. The line then
 * has no options left, so nothing can order it twice. Saves the basket when a line changed.
 */
export async function settleFromOrders(basket: StoredBasket): Promise<StoredBasket> {
  if (basket.status !== "done") return basket;
  const waiting = basket.lines.filter((line) => line.state === "orange" && line.orderId && !line.resolved);
  if (waiting.length === 0) return basket;
  let changed = false;
  for (const line of waiting) {
    const order = await store().orders.get(line.orderId!);
    if (!order || order.buyer.id !== basket.buyer.id || order.status === "pending_approval") continue;
    const { mandate } = await currentMandate(basket.buyer.id);
    const verb = order.status === "confirmed" ? "Approved" : "Decided";
    const sentence = settleLine(line, order, mandate, await store().orders.list(), "the purchasing manager", verb);
    const approval = order.approval;
    if (approval) {
      const optionId = `${line.id}-${approval.decision === "approved" ? "approve" : "skip"}`;
      line.resolved = { optionId, by: approval.decidedBy.name, at: approval.decidedAt, sentence };
    }
    changed = true;
  }
  if (changed) await store().baskets.put(basket);
  return basket;
}

/** One buyer's baskets, or every buyer's in the workspace when no buyer is named; newest first. */
export async function listBaskets(buyerId?: string): Promise<Basket[]> {
  const baskets = (await store().baskets.list()).filter((basket) => !buyerId || basket.buyer.id === buyerId);
  const current = await Promise.all(baskets.map(settleFromOrders));
  return current.reverse().map(toBasket);
}

/** A basket of the given buyer, its lines settled with their orders; another buyer's basket is not found, as if missing. */
export async function storedBasket(id: string, buyerId: string): Promise<StoredBasket> {
  const basket = await store().baskets.get(id);
  if (!basket || basket.buyer.id !== buyerId) throw new NotFoundError(`Basket ${id} was not found.`);
  return settleFromOrders(basket);
}

export async function getBasket(id: string, buyerId: string): Promise<Basket> {
  return toBasket(await storedBasket(id, buyerId));
}
