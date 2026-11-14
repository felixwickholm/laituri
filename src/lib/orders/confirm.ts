import type { Order } from "@/lib/contracts";
import { saveThenLog, stored } from "./commit";
import { responseCode, signReceipt } from "./receipt";
import { SUPPLIER_ACTOR, orderRefs } from "./summaries";
import type { OrderDeps, StoredOrder } from "./types";

/**
 * Saves the order as confirmed, records the confirmation, then signs the receipt that points at that audit entry.
 * A failure before the entry undoes the save; a failure after it leaves a confirmed order whose receipt a retry
 * with the same idempotency key completes (see completeReceipt).
 */
export async function confirmOrder(previous: StoredOrder | undefined, order: Order, summary: string, idempotencyKey: string | undefined, deps: OrderDeps): Promise<Order> {
  const confirmed: Order = { ...order, status: "confirmed", updatedAt: deps.now().toISOString() };
  const entry = await saveThenLog(previous, stored(confirmed, idempotencyKey), {
    actor: SUPPLIER_ACTOR,
    event: "order.confirmed",
    summary,
    refs: orderRefs(order),
    data: {
      responseCode: responseCode(confirmed),
      totals: confirmed.offer.totals,
      deliveryDate: confirmed.offer.deliveryDate,
      simulated: true,
    },
  }, deps);
  const receipted: Order = { ...confirmed, receiptJws: await signReceipt(confirmed, entry.seq, deps) };
  await deps.store.orders.put(stored(receipted, idempotencyKey));
  return receipted;
}

/** A confirmed order whose receipt was not saved gets it now, signed against its order.confirmed entry. */
export async function completeReceipt(order: StoredOrder, deps: OrderDeps): Promise<Order> {
  if (order.status !== "confirmed" || order.receiptJws) return order;
  const entries = await deps.store.audit.list();
  const entry = entries.find((item) => item.event === "order.confirmed" && item.refs.orderId === order.id);
  if (!entry) return order;
  const receipted: StoredOrder = { ...order, receiptJws: await signReceipt(order, entry.seq, deps) };
  await deps.store.orders.put(receipted);
  return receipted;
}
