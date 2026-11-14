import { runPurchase } from "../purchase";
import type { AgentHooks, AgentTransport, PurchaseResult } from "../types";
import { providerFor, selectEngine, type EngineChoice } from "./engine";
import { runModelPurchase } from "./loop";
import type { AgentEngine } from "./types";

/** What health reports: the engine that runs free-text requests now, and its model. */
export function activeEngine(env: Record<string, string | undefined> = process.env): { engine: AgentEngine; model?: string } {
  const { engine, model } = selectEngine(env);
  return model ? { engine, model } : { engine };
}

/** Runs a free-text request with the selected engine. Without a usable model the scripted agent runs it. */
export async function runBuyerAgent(
  requestText: string,
  transport: AgentTransport,
  hooks: AgentHooks,
  choice: EngineChoice = selectEngine(),
): Promise<PurchaseResult> {
  const provider = providerFor(choice);
  if (provider) return runModelPurchase(requestText, transport, hooks, provider);
  if (!choice.unavailable) return runPurchase(requestText, transport, hooks);
  const step = { text: `The model agent is not available: ${choice.unavailable} The scripted agent runs this request.`, status: "error" as const };
  await hooks.note(step.text, step.status);
  const result = await runPurchase(requestText, transport, hooks);
  return { ...result, steps: [step, ...result.steps] };
}
