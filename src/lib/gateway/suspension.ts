import type { AgentSuspension, SuspensionRequest, SuspensionState } from "@/lib/contracts";
import { ISSUER } from "@/lib/offers/assemble";
import { SUPPLIER_ACTOR } from "@/lib/orders/summaries";
import { AgentSuspendedError, NotFoundError } from "./errors";
import type { Recorder } from "./recorder";
import type { AgentRef, Deps } from "./types";

type SuspensionDeps = Pick<Deps, "store" | "audit" | "now">;

interface Party {
  id: string;
  name: string;
}

export interface Suspensions {
  /** Throws AgentSuspendedError for a suspended agent, after logging the refused call. `call` names it, for example "POST /api/v1/quotes". */
  admit(agent: AgentRef, call: string): Promise<void>;
  /** Suspends or resumes an agent that has reached the wholesaler. Asking for the state it is already in changes nothing. */
  set(agentId: string, change: SuspensionRequest): Promise<SuspensionState>;
}

function state(agent: Party, buyer: Party | undefined, suspension?: AgentSuspension): SuspensionState {
  const base = { agent, ...(buyer ? { buyer } : {}) };
  if (!suspension) return { ...base, suspended: false };
  return { ...base, suspended: true, suspendedAt: suspension.suspendedAt, ...(suspension.reason ? { reason: suspension.reason } : {}) };
}

function refusal(agent: AgentRef, suspension: AgentSuspension): string {
  const why = suspension.reason ? ` Reason: ${suspension.reason}` : "";
  return `${ISSUER} has suspended ${agent.name}, so it refuses every call until the agent is resumed.${why}`;
}

/** The wholesaler's control over connected agents. Every suspension, resumption and refused call is a signed audit entry. */
export function createSuspensions(deps: SuspensionDeps, recorder: Pick<Recorder, "note">): Suspensions {
  /** The agent as the wholesaler last saw it, and the buyer it worked for. */
  async function known(agentId: string): Promise<{ agent: Party; buyer?: Party } | undefined> {
    const seen = (await deps.store.activity.list()).findLast((item) => item.agent.id === agentId);
    if (seen) return { agent: seen.agent, buyer: seen.buyer };
    const order = (await deps.store.orders.list()).findLast((item) => item.agent.id === agentId);
    return order ? { agent: order.agent, buyer: order.buyer } : undefined;
  }

  return {
    async admit(agent, call) {
      const suspension = await deps.store.suspensions.get(agent.id);
      if (!suspension) return;
      const message = refusal(agent, suspension);
      await deps.audit.append({
        actor: SUPPLIER_ACTOR,
        event: "access.refused",
        summary: `${ISSUER} refused ${call} by ${agent.name}: the agent is suspended.`,
        refs: agent.buyer ? { buyerId: agent.buyer.id } : {},
        data: { code: "agent_suspended", agentId: agent.id, call, suspendedAt: suspension.suspendedAt },
      });
      await recorder.note(agent, `Refused ${call}: the agent is suspended`, { status: "blocked", detail: message });
      throw new AgentSuspendedError(message);
    },

    async set(agentId, change) {
      const found = await known(agentId);
      if (!found) throw new NotFoundError(`No agent with the id ${agentId} has reached ${ISSUER}.`);
      const { agent, buyer } = found;
      const current = await deps.store.suspensions.get(agentId);
      if (change.suspended === (current !== undefined)) return state(agent, buyer, current);
      const refs = buyer ? { buyerId: buyer.id } : {};

      if (!change.suspended) {
        await deps.store.suspensions.remove(agentId);
        await deps.audit.append({
          actor: SUPPLIER_ACTOR,
          event: "agent.resumed",
          summary: `${ISSUER} resumed ${agent.name}. Its calls are served again.`,
          refs,
          data: { agentId, suspendedAt: current?.suspendedAt, ...(change.reason ? { reason: change.reason } : {}) },
        });
        return state(agent, buyer);
      }

      const suspension: AgentSuspension = {
        agent,
        ...(buyer ? { buyer } : {}),
        suspendedAt: deps.now().toISOString(),
        ...(change.reason ? { reason: change.reason } : {}),
      };
      await deps.store.suspensions.put(suspension);
      await deps.audit.append({
        actor: SUPPLIER_ACTOR,
        event: "agent.suspended",
        summary: `${ISSUER} suspended ${agent.name}. Every call it makes is refused until it is resumed.${change.reason ? ` Reason: ${change.reason}` : ""}`,
        refs,
        data: { agentId, ...(change.reason ? { reason: change.reason } : {}) },
      });
      return state(agent, buyer, suspension);
    },
  };
}
