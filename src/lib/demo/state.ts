import type { AuditEntry } from "@/lib/contracts";
import type { AgentHooks, AgentTransport, PurchaseResult } from "@/lib/agent";
import type { AgentRef } from "@/lib/gateway";

export interface ScenarioContext {
  agent: AgentRef;
  transport: AgentTransport;
  hooks: AgentHooks;
  /** The server's own address, when known, so refusals can be shown over the public interface. */
  baseUrl?: string;
}

export interface ScenarioOutcome {
  summary: string;
  results: PurchaseResult[];
}

export type ScenarioId = "milk" | "over-limit" | "break-mandate";

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

const holder = globalThis as typeof globalThis & { __laituriDemo?: DemoState };

/** Held on globalThis so runs survive module reloads in development. */
export function demoState(): DemoState {
  return (holder.__laituriDemo ??= { runs: new Map(), generation: 0 });
}
