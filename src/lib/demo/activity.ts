import type { AgentHooks, NoteStatus } from "@/lib/agent";
import { appendAudit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { AgentRef } from "@/lib/gateway";
import { currentRun } from "@/lib/gateway/recorder";
import { newId } from "@/lib/offers/assemble";
import { agentActor } from "@/lib/orders/summaries";
import { store } from "@/lib/store";

/** Thrown at the next step of a run that a reset cancelled. */
export class RunCancelled extends Error {
  constructor() {
    super("The demo was reset.");
    this.name = "RunCancelled";
  }
}

export function stepMs(): number {
  const value = Number(process.env.LAITURI_DEMO_STEP_MS ?? 900);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function appendNote(agent: AgentRef, title: string, status: NoteStatus = "ok"): Promise<void> {
  const run = currentRun();
  await store().activity.append({ id: newId("act_"), at: now().toISOString(), agent, kind: "note", title, status, ...(run ? { run } : {}) });
}

/**
 * The gateway records an agent's first visit when it first sees the agent in the activity pane.
 * Agent notes are written before the first call, so the visit is recorded here in the same shape.
 */
export async function ensureConnected(agent: AgentRef): Promise<void> {
  const seen = (await store().activity.list()).some((activity) => activity.agent.id === agent.id);
  if (seen) return;
  await appendAudit({
    actor: agentActor(agent),
    event: "agent.connected",
    summary: `${agent.name} connected for the first time.`,
    data: { agentId: agent.id },
  });
  await appendNote(agent, `${agent.name} connected`);
}

/** Notes go to the activity pane; pauses pace the run so a person can follow it. */
export function demoHooks(agent: AgentRef, isCancelled: () => boolean): AgentHooks {
  return {
    async note(text, status) {
      if (isCancelled()) throw new RunCancelled();
      await appendNote(agent, text, status);
    },
    async pause() {
      const ms = stepMs();
      if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
      if (isCancelled()) throw new RunCancelled();
    },
  };
}
