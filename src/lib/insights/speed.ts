import type { AuditEntry, Order } from "@/lib/contracts";
import type { DemandRecord } from "@/lib/demand/types";
import { requestOfOrder } from "./links";
import { median } from "./median";
import { orderOutcome } from "./orders";

/**
 * Seconds from the start of a request (its first search, or its first quote when it began with one) to each order
 * that confirmed it without a person, as a median. Orders on an alternative offer count from the request whose quote
 * issued it. Seeded history is left out: it is written on a backdated clock, so its gaps are planned, not measured.
 */
export function medianSecondsRequestToConfirmed(requests: DemandRecord[], orders: Order[], audit: AuditEntry[]): number | undefined {
  const live = requests.filter((record) => !record.seeded).sort((a, b) => a.at.localeCompare(b.at));
  const startOf = new Map<string, number>();
  for (const record of live) if (!startOf.has(record.requestId)) startOf.set(record.requestId, Date.parse(record.at));
  const requestOf = requestOfOrder(live, orders, audit);
  const seconds: number[] = [];
  for (const order of orders) {
    if (order.seeded || orderOutcome(order) !== "confirmed_auto") continue;
    const requestId = requestOf.get(order.id);
    const start = requestId === undefined ? undefined : startOf.get(requestId);
    if (start !== undefined) seconds.push((Date.parse(order.createdAt) - start) / 1000);
  }
  const middle = median(seconds);
  return middle === undefined ? undefined : Math.round(middle);
}
