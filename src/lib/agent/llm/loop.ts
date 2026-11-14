import { now } from "@/lib/clock";
import { runPurchase } from "../purchase";
import type { AgentHooks, AgentTransport, NoteStatus, PurchaseResult, PurchaseStatus, PurchaseStep } from "../types";
import { orderOutcome } from "./outcome";
import { SYSTEM_PROMPT, requestMessage } from "./prompt";
import { runTool, toolSpecs, type ToolSession } from "./tools";
import { ProviderError, type ModelEngine, type ModelProvider, type ModelReply, type ToolOutcome } from "./types";

const MAX_ROUNDS = 8;
const RUN_TIMEOUT_MS = 60_000;

const ENGINE_NAMES: Record<ModelEngine, string> = { claude: "Claude", gemini: "Gemini" };

export interface ModelRunOptions {
  maxRounds?: number;
  timeoutMs?: number;
  /** Who takes over when this model cannot finish, and its name for the note. Default: the scripted agent. */
  next?: { name: string; run: () => Promise<PurchaseResult> };
}

function reasonOf(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return "it ran out of time.";
  if (error instanceof ProviderError) return error.message;
  return "its answer could not be read.";
}

/**
 * The buyer's purchasing agent driven by a language model. The model chooses tools; the code holds the signed
 * offers and the mandate and sends them unchanged, so the model can neither price nor sign anything.
 * When the model cannot finish, the scripted agent runs the same request and a note says so.
 */
export async function runModelPurchase(
  requestText: string,
  transport: AgentTransport,
  hooks: AgentHooks,
  provider: ModelProvider,
  options: ModelRunOptions = {},
): Promise<PurchaseResult> {
  const steps: PurchaseStep[] = [];
  const say = async (text: string, status: NoteStatus = "ok") => {
    steps.push({ text, status });
    await hooks.note(text, status);
  };
  const finish = async (status: PurchaseStatus, summary: string, noteStatus: NoteStatus, extra: Partial<PurchaseResult> = {}) => {
    await say(summary, noteStatus);
    return { status, summary, steps, ...extra };
  };
  const fallback = async (reason: string): Promise<PurchaseResult> => {
    const next = options.next ?? { name: "The scripted agent", run: () => runPurchase(requestText, transport, hooks) };
    await say(`The ${ENGINE_NAMES[provider.engine]} agent stopped: ${reason} ${next.name} takes over.`, "error");
    const taken = await next.run();
    return { ...taken, steps: [...steps, ...taken.steps] };
  };

  const signal = AbortSignal.timeout(options.timeoutMs ?? RUN_TIMEOUT_MS);
  const session: ToolSession = { transport, request: requestText, offers: new Map() };
  const conversation = provider.open({ system: SYSTEM_PROMPT, request: requestMessage(requestText, now()), tools: toolSpecs() });
  let results: ToolOutcome[] = [];

  for (let round = 0; round < (options.maxRounds ?? MAX_ROUNDS); round++) {
    let reply: ModelReply;
    try {
      reply = await conversation.next(results, signal);
    } catch (error) {
      return fallback(reasonOf(error, signal));
    }
    if (reply.status === "refused") return fallback(`it declined the request. ${reply.detail}`);
    if (reply.status === "final") {
      return reply.text ? finish("needs_input", reply.text, "waiting") : fallback("it gave an empty answer.");
    }
    if (reply.text) await say(reply.text);

    results = [];
    for (const call of reply.calls) {
      const effect = await runTool(call, session);
      if (effect.kind === "ordered") {
        const outcome = orderOutcome(effect.order, effect.mandate);
        await say(outcome.note, outcome.noteStatus);
        return { status: outcome.status, summary: outcome.summary, steps, orderId: effect.order.id, offerId: effect.offer.offer.id };
      }
      if (effect.kind === "ask") return finish("needs_input", effect.question, "waiting");
      if (effect.kind === "stop") return finish("not_found", `${effect.reason} No order placed.`, "error");
      if (effect.kind === "refused") return finish("needs_input", `${effect.sentence} No order placed.`, "blocked");
      if (effect.kind === "reply" && effect.note) await say(effect.note);
      results.push({ callId: call.id, name: call.name, content: effect.content, isError: effect.kind === "error" });
    }
    await hooks.pause();
  }
  return fallback(`it did not finish within ${options.maxRounds ?? MAX_ROUNDS} rounds.`);
}
