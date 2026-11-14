import type { AuditEntry, Order } from "@/lib/contracts";
import type { DemandRecord } from "@/lib/demand/types";

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
 * Which request each order answers: the request whose quote signed the order's offer. An order on an alternative
 * offer belongs to the request whose quote issued it. Orders whose offer no logged quote produced are left out.
 */
export function requestOfOrder(requests: DemandRecord[], orders: Order[], audit: AuditEntry[]): Map<string, string> {
  const requestOfOffer = new Map<string, string>();
  for (const record of requests) if (record.offerId) requestOfOffer.set(record.offerId, record.requestId);
  const primaryOf = primaryOffers(audit);
  const links = new Map<string, string>();
  for (const order of orders) {
    const requestId = requestOfOffer.get(primaryOf.get(order.offer.id) ?? order.offer.id);
    if (requestId !== undefined) links.set(order.id, requestId);
  }
  return links;
}
