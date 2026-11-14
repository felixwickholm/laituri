import type { AuditEntry, Order, SupplierOverview } from "@/lib/contracts";

/** The live figures on the landing page. Undefined means the source did not answer; the page shows a dash. */
export interface LandingCounts {
  signedOffers?: number;
  ordersConfirmed?: number;
  logSteps?: number;
  connectedAgents?: number;
  /** Median seconds from a signed offer to the order that carried it. */
  secondsToOrder?: number;
}

export interface CountSources {
  orders?: Order[];
  audit?: AuditEntry[];
  overview?: SupplierOverview;
}

/** Distinct agents that appear as actors in the signed log. */
export function agentsInAudit(audit: AuditEntry[]): number {
  return new Set(audit.filter((entry) => entry.actor.type === "agent").map((entry) => entry.actor.id)).size;
}

export function landingCounts({ orders, audit, overview }: CountSources): LandingCounts {
  const seconds = overview?.offers.medianSecondsToOrder;
  return {
    signedOffers: audit?.filter((entry) => entry.event === "offer.issued").length,
    ordersConfirmed: orders?.filter((order) => order.status === "confirmed").length,
    logSteps: audit?.length,
    connectedAgents: overview ? overview.agents.length : audit ? agentsInAudit(audit) : undefined,
    secondsToOrder: seconds === undefined ? undefined : Math.round(seconds),
  };
}
