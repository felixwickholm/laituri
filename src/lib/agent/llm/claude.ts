import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type ModelProvider, type ModelReply, type ToolOutcome, type ToolSpec } from "./types";

const MAX_TOKENS = 16_000;
/** Returns the short notes the model writes between tool calls as thinking text, while its reasoning stays hidden. */
const PROGRESS_UPDATES_BETA = "thinking-display-updates-2026-08-18";
const INTERRUPTED = "This part of the response was interrupted before it finished.";

type Message = Anthropic.Beta.BetaMessage;

export interface ClaudeOptions {
  apiKey: string;
  model: string;
  /** Replaces the network in tests. */
  fetch?: typeof fetch;
}

function toolDefinition(spec: ToolSpec): Anthropic.Beta.BetaTool {
  return { name: spec.name, description: spec.description, input_schema: { type: "object", ...spec.parameters } };
}

function toolResults(results: ToolOutcome[]): Anthropic.Beta.BetaMessageParam {
  return {
    role: "user",
    content: results.map((result) => ({ type: "tool_result", tool_use_id: result.callId, content: result.content, is_error: result.isError })),
  };
}

/** Text blocks and progress notes, in order. */
function visibleText(message: Message): string {
  const parts = message.content.flatMap((block) => {
    if (block.type === "text") return [block.text];
    if (block.type === "thinking" && block.thinking && block.thinking !== INTERRUPTED) return [block.thinking];
    return [];
  });
  return parts.map((part) => part.trim()).filter(Boolean).join(" ");
}

function toReply(message: Message): ModelReply {
  if (message.stop_reason === "refusal") {
    return { status: "refused", detail: message.stop_details?.explanation ?? "No reason was given." };
  }
  if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") {
    throw new ProviderError("Claude's answer was cut off.");
  }
  const text = visibleText(message);
  const calls = message.content.flatMap((block) => (block.type === "tool_use" ? [{ id: block.id, name: block.name, input: block.input }] : []));
  return calls.length ? { status: "tool_calls", text, calls } : { status: "final", text };
}

function readable(error: unknown): unknown {
  if (error instanceof Anthropic.APIUserAbortError) return new ProviderError("the request was cancelled.");
  if (error instanceof Anthropic.APIConnectionError) return new ProviderError("Claude could not be reached.");
  if (error instanceof Anthropic.APIError) return new ProviderError(`Claude answered with status ${error.status}.`);
  return error;
}

/** Claude through the official SDK. Each conversation keeps the full assistant content, thinking blocks included. */
export function claudeProvider(options: ClaudeOptions): ModelProvider {
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 1, fetch: options.fetch });
  return {
    engine: "claude",
    model: options.model,
    open({ system, request, tools }) {
      const definitions = tools.map(toolDefinition);
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: request }];
      return {
        async next(results, signal) {
          if (results.length) messages.push(toolResults(results));
          let message: Message;
          try {
            message = await client.beta.messages.create(
              {
                model: options.model,
                max_tokens: MAX_TOKENS,
                betas: [PROGRESS_UPDATES_BETA],
                system,
                tools: definitions,
                messages,
                thinking: { type: "adaptive", display: "updates" },
                output_config: { effort: "medium" },
                cache_control: { type: "ephemeral" },
              },
              { signal },
            );
          } catch (error) {
            throw readable(error);
          }
          messages.push({ role: "assistant", content: message.content });
          return toReply(message);
        },
      };
    },
  };
}
