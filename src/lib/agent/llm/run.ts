import { runPurchase } from "../purchase";
import type { AgentHooks, AgentTransport, PurchaseResult } from "../types";
import { admitModelCall } from "./budget";
import { engineChain, providerFor, selectEngine, type EngineChoice } from "./engine";
import { runModelPurchase } from "./loop";
import { engineResting } from "./rest";
import type { AgentEngine, ModelProvider } from "./types";

/** What health reports: the engine that runs free-text requests now, and its model. */
export function activeEngine(env: Record<string, string | undefined> = process.env): { engine: AgentEngine; model?: string } {
  const { engine, model } = selectEngine(env);
  return model ? { engine, model } : { engine };
}

const ENGINE_NAMES = { claude: "The Claude agent", gemini: "The Gemini agent" } as const;

/**
 * Runs a free-text request with the selected engines in order (Gemini, then Claude, by default). A model that cannot
 * finish hands the request to the next; the scripted agent is always last. Without a usable model, or once the model
 * budget for this caller or this day is spent, the scripted agent runs it.
 */
export async function runBuyerAgent(
  requestText: string,
  transport: AgentTransport,
  hooks: AgentHooks,
  chain: EngineChoice | EngineChoice[] = engineChain(),
): Promise<PurchaseResult> {
  const choices = Array.isArray(chain) ? chain : [chain];
  const choice = choices[0] ?? { engine: "scripted" as const };
  // A model resting after "too many requests" is skipped; the scripted agent is always there behind the models.
  const providers = choices
    .map((item) => providerFor(item))
    .filter((item): item is ModelProvider => item !== undefined && !engineResting(item.engine));
  if (providers.length && admitModelCall()) {
    const runFrom = (index: number): Promise<PurchaseResult> => {
      const later = providers[index + 1];
      return runModelPurchase(requestText, transport, hooks, providers[index], {
        next: later ? { name: ENGINE_NAMES[later.engine], run: () => runFrom(index + 1) } : undefined,
      });
    };
    return runFrom(0);
  }
  if (providers.length || !choice.unavailable) return runPurchase(requestText, transport, hooks);
  const step = { text: `The model agent is not available: ${choice.unavailable} The scripted agent runs this request.`, status: "error" as const };
  await hooks.note(step.text, step.status);
  const result = await runPurchase(requestText, transport, hooks);
  return { ...result, steps: [step, ...result.steps] };
}
