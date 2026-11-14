import type { AuditEntry, Order } from "@/lib/contracts";
import type { DemandRecord } from "@/lib/demand/types";
import { median } from "./median";
import { orderOutcome } from "./orders";

/** Each alternative offer and the primary offer of the quote that issued it, from the signed offer.issued entries. */
function primaryOffers(audit: AuditEntry[]): Map<string, string> {
  const primaryOf = new Map<string, string>();
  for (const entry of audit) {
    const primary = entry.refs.offerId;
    const alternatives = entry.data.alternativeOfferIds;
    if (entry.event !== "offer.issued" || !primary || !Array.isArray(alternatives)) continue;
    for (const id of alternatives) if (typeof id === "string") primaryOf.set(id, primary);
  }
  return primaryOf;
}

/**
 * Seconds from the start of a request (its first search, or its first quote when it began with one) to each order
 * that confirmed it without a person, as a median. Orders on an alternative offer count from the request whose quote
 * issued it. Seeded history is left out: it is written on a backdated clock, so its gaps are planned, not measured.
 */
export function medianSecondsRequestToConfirmed(requests: DemandRecord[], orders: Order[], audit: AuditEntry[]): number | undefined {
  const live = requests.filter((record) => !record.seeded).sort((a, b) => a.at.localeCompare(b.at));
  const startOf = new Map<string, number>();
  const requestOfOffer = new Map<string, string>();
  for (const record of live) {
    if (!startOf.has(record.requestId)) startOf.set(record.requestId, Date.parse(record.at));
    if (record.offerId) requestOfOffer.set(record.offerId, record.requestId);
  }
  const primaryOf = primaryOffers(audit);
  const seconds: number[] = [];
  for (const order of orders) {
    if (order.seeded || orderOutcome(order) !== "confirmed_auto") continue;
    const requestId = requestOfOffer.get(primaryOf.get(order.offer.id) ?? order.offer.id);
    const start = requestId === undefined ? undefined : startOf.get(requestId);
    if (start !== undefined) seconds.push((Date.parse(order.createdAt) - start) / 1000);
  }
  const middle = median(seconds);
  return middle === undefined ? undefined : Math.round(middle);
}
