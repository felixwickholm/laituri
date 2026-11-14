import type { AuditEntry } from "@/lib/contracts";
import { dayAndTime } from "./format/time";

/** Where a buyer reaches Valio Aimo about a suspended agent. */
export const SUPPLIER_CONTACT = "https://www.valioaimo.fi";

/** The wholesaler's suspension of this buyer's agent, as the signed log records it. */
export interface AgentSuspension {
  suspendedAt: string;
  reason?: string;
  /** The operator who suspended the agent. */
  by?: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * The newest suspend or resume of the agent in the signed log decides: suspended when the newest one is a suspension.
 * Undefined while the agent is served.
 */
export function agentSuspension(audit: readonly AuditEntry[], agentId: string | undefined): AgentSuspension | undefined {
  if (!agentId) return undefined;
  for (let i = audit.length - 1; i >= 0; i--) {
    const entry = audit[i];
    if (entry.event !== "agent.suspended" && entry.event !== "agent.resumed") continue;
    if (entry.data?.agentId !== agentId) continue;
    if (entry.event === "agent.resumed") return undefined;
    const operator = entry.data.operator as { name?: unknown } | undefined;
    const reason = text(entry.data.reason);
    const by = text(operator?.name) ?? text(entry.actor?.name);
    return { suspendedAt: entry.at, ...(reason ? { reason } : {}), ...(by ? { by } : {}) };
  }
  return undefined;
}

/** "Since Sat 14 Nov, 12:04, by Anna Virtanen. Reason: Unusual order volume." */
export function suspensionLine(suspension: AgentSuspension): string {
  const by = suspension.by ? ` by ${suspension.by}` : "";
  const reason = suspension.reason ? ` Reason: ${suspension.reason.replace(/\.?$/, ".")}` : " No reason was given.";
  return `Since ${dayAndTime(suspension.suspendedAt)}${by ? `,${by}` : ""}.${reason}`;
}
