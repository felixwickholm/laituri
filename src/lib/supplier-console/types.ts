import type { ConnectedAgent, SupplierOverview } from "@/lib/contracts";
import type { PurchaseStatus } from "@/lib/agent/types";

export type { ConceptDemand, DailyPoint, OfferStats, OutcomeCounts, RuleStat, UnmetReason, UnmetRequest } from "@/lib/contracts";

/** The control screens read the contracts as they are; these names say which side of the product holds them. */
export type ControlAgent = ConnectedAgent;
export type ControlOverview = SupplierOverview;

/** One purchase in a demo run, as the run endpoint reports it. */
export interface RunResult {
  status: PurchaseStatus;
  summary: string;
  orderId?: string;
}

export interface ScenarioRun {
  id: string;
  status: "running" | "done" | "failed";
  /** For a fixed scene this is the scene's title; the buyer's sentence is on the run's activity. */
  request: string;
  scenario?: string;
  startedAt?: string;
  summary?: string;
  results?: RunResult[];
}
