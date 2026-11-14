import { z } from "zod";
import { ProviderError, type ModelProvider, type ModelReply, type ToolCall, type ToolOutcome, type ToolSpec } from "./types";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_OUTPUT_TOKENS = 8_192;
const REFUSALS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

/** Parts are kept loose so fields this code does not read, such as thought signatures, go back unchanged. */
const Part = z
  .object({
    text: z.string().optional(),
    thought: z.boolean().optional(),
    functionCall: z.object({ id: z.string().optional(), name: z.string(), args: z.record(z.string(), z.unknown()).optional() }).optional(),
  })
  .loose();
type Part = z.infer<typeof Part>;

const Content = z.object({ role: z.string().optional(), parts: z.array(Part).default([]) }).loose();
type Content = z.infer<typeof Content>;

const GenerateResponse = z.object({
  candidates: z.array(z.object({ content: Content.optional(), finishReason: z.string().optional() })).optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

export interface GeminiOptions {
  apiKey: string;
  model: string;
  /** Replaces the network in tests. */
  fetch?: typeof fetch;
}

function declaration(spec: ToolSpec) {
  return { name: spec.name, description: spec.description, parametersJsonSchema: spec.parameters };
}

async function post(options: GeminiOptions, body: unknown, signal: AbortSignal): Promise<unknown> {
  const url = `${API_ROOT}/${encodeURIComponent(options.model)}:generateContent`;
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ProviderError(signal.aborted ? "the request was cancelled." : "Gemini could not be reached.");
  }
  if (!response.ok) throw new ProviderError(`Gemini answered with status ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new ProviderError("Gemini's answer was not JSON.");
  }
}

/** Gemini through the Generative Language REST API with function calling. */
export function geminiProvider(options: GeminiOptions): ModelProvider {
  return {
    engine: "gemini",
    model: options.model,
    open({ system, request, tools }) {
      const contents: Content[] = [{ role: "user", parts: [{ text: request }] }];
      /** Gemini may leave out call ids; only the ids it sent go back. */
      const sentIds = new Map<string, string | undefined>();
      let turn = 0;

      function responseParts(results: ToolOutcome[]): Part[] {
        return results.map((result) => ({
          functionResponse: {
            ...(sentIds.get(result.callId) ? { id: sentIds.get(result.callId) } : {}),
            name: result.name,
            response: result.isError ? { error: result.content } : { content: result.content },
          },
        }));
      }

      function toReply(raw: unknown): ModelReply {
        const parsed = GenerateResponse.safeParse(raw);
        if (!parsed.success) throw new ProviderError("Gemini's answer did not have the expected shape.");
        const { candidates, promptFeedback } = parsed.data;
        if (promptFeedback?.blockReason) return { status: "refused", detail: `Blocked: ${promptFeedback.blockReason}.` };
        const candidate = candidates?.[0];
        if (!candidate) throw new ProviderError("Gemini returned no answer.");
        if (candidate.finishReason && REFUSALS.has(candidate.finishReason)) {
          return { status: "refused", detail: `Stopped for ${candidate.finishReason.toLowerCase()}.` };
        }
        if (candidate.finishReason === "MAX_TOKENS") throw new ProviderError("Gemini's answer was cut off.");
        if (!candidate.content) throw new ProviderError("Gemini returned an empty answer.");
        contents.push({ ...candidate.content, role: "model" });
        turn += 1;
        const parts = candidate.content.parts;
        const text = parts.filter((part) => !part.thought && part.text).map((part) => part.text?.trim()).join(" ").trim();
        const calls: ToolCall[] = parts.flatMap((part, index) => {
          if (!part.functionCall) return [];
          const id = `call_${turn}_${index}`;
          sentIds.set(id, part.functionCall.id);
          return [{ id, name: part.functionCall.name, input: part.functionCall.args ?? {} }];
        });
        return calls.length ? { status: "tool_calls", text, calls } : { status: "final", text };
      }

      return {
        async next(results, signal) {
          if (results.length) contents.push({ role: "user", parts: responseParts(results) });
          const raw = await post(
            options,
            {
              systemInstruction: { parts: [{ text: system }] },
              contents,
              tools: [{ functionDeclarations: tools.map(declaration) }],
              generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
            },
            signal,
          );
          return toReply(raw);
        },
      };
    },
  };
}
