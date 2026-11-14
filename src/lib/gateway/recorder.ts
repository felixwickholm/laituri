import { AsyncLocalStorage } from "node:async_hooks";
import { newId } from "@/lib/offers/assemble";
import { agentActor } from "@/lib/orders/summaries";
import { seededMark } from "@/lib/provenance";
import type { Activity } from "@/lib/store/types";
import { errorMessage } from "./errors";
import type { AgentRef, Deps } from "./types";

export interface Outcome {
  /** Replaces the title given up front, when the result makes it more specific. */
  title?: string;
  detail?: string;
  status?: Activity["status"];
  refs?: Activity["refs"];
}

export interface Recorder {
  /** Run one agent-facing call and record it in the activity pane, including failures. */
  track<T>(agent: AgentRef, tool: string, title: string, run: () => Promise<T>, describe: (result: T) => Outcome): Promise<T>;
  note(agent: AgentRef, title: string, outcome: Outcome): Promise<void>;
  reset(): void;
}

export type RunTag = NonNullable<Activity["run"]>;

const holder = globalThis as typeof globalThis & { __laituriRunContext?: AsyncLocalStorage<RunTag> };
const runContext = (holder.__laituriRunContext ??= new AsyncLocalStorage<RunTag>());

/** Tags every activity record made while `work` runs, including the gateway's own tool calls. */
export function inRun<T>(run: RunTag, work: () => Promise<T>): Promise<T> {
  return runContext.run(run, work);
}

/** The run the current call belongs to, if a scripted run started it. */
export function currentRun(): RunTag | undefined {
  return runContext.getStore();
}

/** The agent, its buyer and its client application, as an activity record names them. */
export function callerFields(agent: AgentRef): Pick<Activity, "agent" | "buyer" | "client"> {
  return {
    agent: { id: agent.id, name: agent.name },
    ...(agent.buyer ? { buyer: { id: agent.buyer.id, name: agent.buyer.name } } : {}),
    ...(agent.client ? { client: agent.client } : {}),
  };
}

export function createRecorder(deps: Pick<Deps, "store" | "audit" | "now">): Recorder {
  let known: Set<string> | undefined;

  async function append(agent: AgentRef, activity: Omit<Activity, "id" | "at" | "agent" | "buyer" | "client">): Promise<void> {
    const run = currentRun();
    await deps.store.activity.append({
      id: newId("act_"),
      at: deps.now().toISOString(),
      ...callerFields(agent),
      ...activity,
      ...(run ? { run } : {}),
      ...seededMark(),
    });
  }

  async function connect(agent: AgentRef): Promise<void> {
    known ??= new Set((await deps.store.activity.list()).map((activity) => activity.agent.id));
    if (known.has(agent.id)) return;
    known.add(agent.id);
    await deps.audit.append({
      actor: agentActor(agent),
      event: "agent.connected",
      summary: `${agent.name} connected for the first time.`,
      refs: agent.buyer ? { buyerId: agent.buyer.id } : {},
      data: { agentId: agent.id },
    });
    await append(agent, { kind: "note", title: `${agent.name} connected`, status: "ok" });
  }

  return {
    async track(agent, tool, title, run, describe) {
      await connect(agent);
      const started = performance.now();
      const elapsed = () => Math.round(performance.now() - started);
      try {
        const result = await run();
        const outcome = describe(result);
        await append(agent, { kind: "tool", tool, status: "ok", ...outcome, title: outcome.title ?? title, durationMs: elapsed() });
        return result;
      } catch (error) {
        await append(agent, { kind: "tool", tool, title, status: "error", detail: errorMessage(error), durationMs: elapsed() });
        throw error;
      }
    },
    async note(agent, title, outcome) {
      await append(agent, { kind: "note", title, status: "ok", ...outcome });
    },
    reset() {
      known = undefined;
    },
  };
}
