import { DEMO_AGENT, gatewayTransport } from "@/lib/agent";
import { now } from "@/lib/clock";
import { GatewayError } from "@/lib/gateway/errors";
import { SCRIPTED_CLIENT } from "@/lib/http/client-app";
import { buyerParty, currentMandate } from "@/lib/mandate";
import { newId } from "@/lib/offers/assemble";
import { RunCancelled, appendNote, demoHooks, ensureConnected } from "./activity";
import { SCENARIOS, freeText } from "./scenarios";
import { demoState, type DemoRun, type ScenarioAgent, type ScenarioId } from "./state";

export class RunActiveError extends GatewayError {
  constructor() {
    super("A run is already active.", 409, "run_active");
  }
}

export interface StartRun {
  scenario?: ScenarioId;
  request?: string;
}

/** Starts a scene in the background and returns at once. Only one run at a time. */
export function startRun(input: StartRun, options: { baseUrl?: string } = {}): { runId: string; done: Promise<void> } {
  const state = demoState();
  if (state.active && state.runs.get(state.active)?.status === "running") throw new RunActiveError();
  const scenario = input.scenario ? SCENARIOS[input.scenario] : freeText(input.request ?? "");
  const run: DemoRun = {
    id: newId("run_"),
    status: "running",
    scenario: input.scenario,
    request: input.request ?? scenario.title,
    startedAt: now().toISOString(),
  };
  state.runs.set(run.id, run);
  state.active = run.id;
  const generation = state.generation;
  const cancelled = () => demoState().generation !== generation;
  // The scenes play the primary buyer's agent, the one the demo token names, unless a scene asks for another buyer's.
  const agent = { ...DEMO_AGENT, buyer: buyerParty(), client: SCRIPTED_CLIENT };
  const agentOf = async (buyerId: string): Promise<ScenarioAgent> => {
    const { mandate } = await currentMandate(buyerId);
    const other = { ...mandate.agent, buyer: buyerParty(buyerId), client: SCRIPTED_CLIENT };
    await ensureConnected(other);
    return { agent: other, transport: gatewayTransport(other), hooks: demoHooks(other, cancelled) };
  };

  const done = (async () => {
    try {
      await ensureConnected(agent);
      const outcome = await scenario.run({
        agent,
        transport: gatewayTransport(agent),
        hooks: demoHooks(agent, cancelled),
        baseUrl: options.baseUrl,
        agentOf,
      });
      Object.assign(run, { status: "done", summary: outcome.summary, results: outcome.results });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Object.assign(run, { status: "failed", summary: message });
      if (!(error instanceof RunCancelled)) await appendNote(agent, `The run stopped: ${message}`, "error").catch(() => undefined);
    } finally {
      run.finishedAt = now().toISOString();
      if (demoState().active === run.id) demoState().active = undefined;
    }
  })();
  return { runId: run.id, done };
}

export function getRun(id: string): DemoRun | undefined {
  return demoState().runs.get(id);
}
