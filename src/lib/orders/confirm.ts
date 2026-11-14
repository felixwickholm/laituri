import type { Order } from "@/lib/contracts";
import { responseCode, signReceipt } from "./receipt";
import { SUPPLIER_ACTOR } from "./summaries";
import type { OrderDeps } from "./types";

/** Record the confirmation, then sign the receipt that points at that audit entry. */
export async function confirmOrder(order: Order, summary: string, deps: OrderDeps): Promise<Order> {
  const confirmed: Order = { ...order, status: "confirmed", updatedAt: deps.now().toISOString() };
  const entry = await deps.audit.append({
    actor: SUPPLIER_ACTOR,
    event: "order.confirmed",
    summary,
    refs: { orderId: order.id, offerId: order.offer.id, mandateId: order.mandateId },
    data: {
      responseCode: responseCode(confirmed),
      totals: confirmed.offer.totals,
      deliveryDate: confirmed.offer.deliveryDate,
      simulated: true,
    },
  });
  return { ...confirmed, receiptJws: await signReceipt(confirmed, entry.seq, deps) };
}
