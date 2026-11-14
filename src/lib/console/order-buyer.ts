import type { AuditEntry } from "@/lib/contracts";

/**
 * The buyer an order belongs to, read from the signed log: any entry that names the order also names its buyer.
 * The console polls only its own buyer's orders, so this is how it finds another kitchen's order to show.
 */
export function buyerOfOrder(audit: readonly AuditEntry[], orderId: string): string | undefined {
  return audit.find((entry) => entry.refs.orderId === orderId && entry.refs.buyerId)?.refs.buyerId;
}
