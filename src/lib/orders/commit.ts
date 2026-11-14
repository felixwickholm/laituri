import type { AuditEntry, Order } from "@/lib/contracts";
import type { AuditInput, OrderDeps, StoredOrder } from "./types";

/**
 * Saves an order, then writes the audit entry that announces it. When the entry cannot be written the save is
 * undone, so the log never shows an outcome the store does not hold, and the store never holds one the log does not.
 */
export async function saveThenLog(previous: StoredOrder | undefined, next: StoredOrder, entry: AuditInput, deps: Pick<OrderDeps, "store" | "audit">): Promise<AuditEntry> {
  await deps.store.orders.put(next);
  try {
    return await deps.audit.append(entry);
  } catch (error) {
    await (previous ? deps.store.orders.put(previous) : deps.store.orders.remove(next.id));
    throw error;
  }
}

/** The order as stored, with the key that makes a retry safe. */
export function stored(order: Order, idempotencyKey: string | undefined): StoredOrder {
  return idempotencyKey ? { ...order, idempotencyKey } : order;
}
