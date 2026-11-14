import { connectedAgents } from "./agents";
import { basketStats, chosenByPerson } from "./baskets";
import { dailySeries } from "./daily";
import { requestOfOrder } from "./links";
import { offerStats } from "./offers";
import { markChosen, orderStats } from "./orders";
import { summariseRequests, topConcepts, unmetRequests } from "./requests";
import { firedRules } from "./rules";
import { medianSecondsRequestToConfirmed } from "./speed";
import type { InsightInput, SupplierOverview } from "./types";

export { connectedAgents } from "./agents";
export { basketStats, chosenByPerson } from "./baskets";
export { dailySeries } from "./daily";
export { requestOfOrder } from "./links";
export { offerStats } from "./offers";
export { ORDER_OUTCOMES, markChosen, orderOutcome, orderStats, type CountedOrder } from "./orders";
export { summariseRequests, topConcepts, unmetRequests } from "./requests";
export { firedRules } from "./rules";
export { medianSecondsRequestToConfirmed } from "./speed";
export type * from "./types";

/** The wholesaler's view of agent trade: who connects, what they ask for, what could not be met and why. Pure. */
export function supplierOverview({ now, orders: stored, offers, requests, activity, suspensions, audit, baskets = [], handoffs = [] }: InsightInput): SupplierOverview {
  // An order a person chose on a basket line counts as decided by a person, even when the mandate let it confirm.
  const orders = markChosen(stored, chosenByPerson(baskets));
  const summaries = summariseRequests(requests);
  const toConfirmed = medianSecondsRequestToConfirmed(requests, orders, audit);
  const orderedRequests = new Set(requestOfOrder(requests, orders, audit).values());
  return {
    generatedAt: now.toISOString(),
    includesSeeded: requests.some((record) => record.seeded) || orders.some((order) => order.seeded),
    agents: connectedAgents(activity, orders, now, suspensions),
    demand: { requests: summaries.length, topConcepts: topConcepts(summaries) },
    unmet: unmetRequests(summaries),
    offers: offerStats(offers, orders, now),
    orders: { ...orderStats(orders), ...(toConfirmed !== undefined ? { medianSecondsRequestToConfirmed: toConfirmed } : {}) },
    rules: firedRules(orders),
    daily: dailySeries(summaries, orders, orderedRequests, now),
    baskets: basketStats(baskets),
    handoffs: { open: handoffs.filter((handoff) => handoff.status === "open").length },
  };
}
