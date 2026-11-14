import type { AuditEntry } from "@/lib/contracts";
import type { AgentHooks, AgentTransport, PurchaseResult } from "@/lib/agent";
import type { AgentRef } from "@/lib/gateway";
import { workspaceState } from "@/lib/workspace/context";

/** One buyer's agent as a scene plays it: who it is, how it calls the gateway, and where its notes go. */
export interface ScenarioAgent {
  agent: AgentRef;
  transport: AgentTransport;
  hooks: AgentHooks;
}

export interface ScenarioContext extends ScenarioAgent {
  /** The server's own address, when known, so refusals can be shown over the public interface. */
  baseUrl?: string;
  /** Another demo buyer's agent in the same scene, connected and with its own notes. */
  agentOf(buyerId: string): Promise<ScenarioAgent>;
}

export interface ScenarioOutcome {
  summary: string;
  results: PurchaseResult[];
}

export type ScenarioId = "milk" | "over-limit" | "break-mandate" | "two-kitchens" | "weekly";

export interface DemoRun {
  id: string;
  status: "running" | "done" | "failed";
  scenario?: ScenarioId;
  request: string;
  summary?: string;
  results?: PurchaseResult[];
  startedAt: string;
  finishedAt?: string;
}

interface DemoState {
  runs: Map<string, DemoRun>;
  active?: string;
  /** Bumped on reset, so a run that is still going stops at its next step. */
  generation: number;
  tampered?: { seq: number; original: AuditEntry };
}

/** The current workspace's runs and tampered entry. */
export const demoState = workspaceState<DemoState>("demo", () => ({ runs: new Map(), generation: 0 }));
