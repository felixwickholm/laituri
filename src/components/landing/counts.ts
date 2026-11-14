import type { AuditEntry, Order } from "@/lib/contracts";

/** The four live figures on the landing page. Undefined means the source did not answer; the page shows a dash. */
export interface LandingCounts {
  signedOffers?: number;
  ordersConfirmed?: number;
  logSteps?: number;
  connectedAgents?: number;
}

export interface CountSources {
  orders?: Order[];
  audit?: AuditEntry[];
  /** GET /api/v1/supplier/overview, whatever its exact shape, when the route exists. */
  overview?: unknown;
}

/** Reads a connected-agent count from the supplier overview: a number field or a list of agents. */
export function agentsInOverview(overview: unknown): number | undefined {
  if (!overview || typeof overview !== "object") return undefined;
  const body = overview as Record<string, unknown>;
  for (const key of ["connectedAgents", "agentsConnected", "agentCount"]) {
    if (typeof body[key] === "number") return body[key] as number;
  }
  for (const key of ["agents", "connectedAgents"]) {
    if (Array.isArray(body[key])) return (body[key] as unknown[]).length;
  }
  return undefined;
}

/** Distinct agents that appear as actors in the signed log. */
export function agentsInAudit(audit: AuditEntry[]): number {
  return new Set(audit.filter((entry) => entry.actor.type === "agent").map((entry) => entry.actor.id)).size;
}

export function landingCounts({ orders, audit, overview }: CountSources): LandingCounts {
  return {
    signedOffers: audit?.filter((entry) => entry.event === "offer.issued").length,
    ordersConfirmed: orders?.filter((order) => order.status === "confirmed").length,
    logSteps: audit?.length,
    connectedAgents: agentsInOverview(overview) ?? (audit ? agentsInAudit(audit) : undefined),
  };
}
