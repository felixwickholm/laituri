import type { SupplierOverview } from "@/lib/contracts";
import { weekFigures } from "@/lib/supplier-console/format";

/**
 * The figures in the landing page's one line about this demo week. They come from the same supplier overview, over the same seven
 * days, as the Valio Aimo overview, so the two screens agree. Undefined means the overview did not answer.
 */
export interface LandingFigures {
  agents?: number;
  requests?: number;
  ordersConfirmed?: number;
}

export function landingFigures(overview: SupplierOverview | undefined): LandingFigures {
  if (!overview) return {};
  const week = weekFigures(overview.daily);
  return {
    agents: overview.agents.length,
    requests: week.requests,
    ordersConfirmed: week.confirmed,
  };
}

/** A figure worth showing as a number; zero and missing both become a dash. */
export function shown(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}
