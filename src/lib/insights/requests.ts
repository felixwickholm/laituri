import type { Quantity } from "@/lib/contracts";
import type { DemandRecord } from "@/lib/demand/types";
import type { ConceptDemand, RequestSummary, UnmetReason, UnmetRequest } from "./types";

const UNMET: Record<UnmetReason, string> = {
  short_stock: "Not enough stock to deliver in full on time, and no alternative covered it.",
  cutoff_passed: "The order cut-off for the date had passed.",
  not_found: "Nothing in the catalogue matches.",
};

function lastDefined<K extends keyof DemandRecord>(records: DemandRecord[], key: K): DemandRecord[K] | undefined {
  return records.findLast((record) => record[key] !== undefined)?.[key];
}

/** Groups the log into requests, oldest first. A request starts when it was first seen and ends as its last record says. */
export function summariseRequests(records: DemandRecord[]): RequestSummary[] {
  const groups = new Map<string, DemandRecord[]>();
  for (const record of [...records].sort((a, b) => a.at.localeCompare(b.at))) {
    const group = groups.get(record.requestId);
    if (group) group.push(record);
    else groups.set(record.requestId, [record]);
  }
  return [...groups.entries()].map(([requestId, group]) => {
    const first = group[0];
    const last = group[group.length - 1];
    return {
      requestId,
      at: first.at,
      ...(first.buyer ? { buyer: first.buyer } : {}),
      agent: first.agent,
      client: first.client,
      words: lastDefined(group, "words"),
      concept: lastDefined(group, "concept"),
      quantity: lastDefined(group, "quantity"),
      deliverBy: lastDefined(group, "deliverBy"),
      outcome: last.outcome,
      lostNet: last.lostNet,
      ...(first.seeded ? { seeded: first.seeded } : {}),
    };
  });
}

function addQuantity(totals: Quantity[], quantity: Quantity | undefined): void {
  if (!quantity) return;
  const same = totals.find((total) => total.unit === quantity.unit);
  if (same) same.amount = Math.round((same.amount + quantity.amount) * 1000) / 1000;
  else totals.push({ ...quantity });
}

/** The product types asked for most, with how much was asked in total. */
export function topConcepts(requests: RequestSummary[], limit = 8): ConceptDemand[] {
  const byConcept = new Map<string, ConceptDemand>();
  for (const request of requests) {
    if (!request.concept) continue;
    const entry = byConcept.get(request.concept) ?? { concept: request.concept, requests: 0, quantity: [] };
    entry.requests += 1;
    addQuantity(entry.quantity, request.quantity);
    byConcept.set(request.concept, entry);
  }
  return [...byConcept.values()]
    .sort((a, b) => b.requests - a.requests || a.concept.localeCompare(b.concept))
    .slice(0, limit);
}

function isUnmet(outcome: RequestSummary["outcome"]): outcome is UnmetReason {
  return outcome in UNMET;
}

/** Requests that could not be met in full and on time, or found nothing, newest first. */
export function unmetRequests(requests: RequestSummary[]): UnmetRequest[] {
  return requests
    .flatMap(({ outcome, lostNet, ...request }) =>
      isUnmet(outcome)
        ? [{ ...request, reason: outcome, reasonText: UNMET[outcome], ...(lostNet !== undefined ? { estimatedLostNet: lostNet } : {}) }]
        : [],
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}
