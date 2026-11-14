/** The engines that can drive a free-text purchase. "scripted" is the rule-based agent in ../purchase.ts. */
export type AgentEngine = "claude" | "gemini" | "scripted";
export type ModelEngine = Exclude<AgentEngine, "scripted">;

/** A tool as both providers describe it: a name, when to use it, and a JSON Schema for its input. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolOutcome {
  callId: string;
  name: string;
  content: string;
  isError: boolean;
}

/** One model turn, reduced to what the purchase loop needs. */
export type ModelReply =
  | { status: "tool_calls"; text: string; calls: ToolCall[] }
  | { status: "final"; text: string }
  | { status: "refused"; detail: string };

/** A conversation the provider keeps in its own wire format, so signatures and thinking blocks go back unchanged. */
export interface ModelConversation {
  /** Sends the tool results of the previous turn (none on the first) and returns the next reply. */
  next(results: ToolOutcome[], signal: AbortSignal): Promise<ModelReply>;
}

export interface ModelProvider {
  engine: ModelEngine;
  model: string;
  open(start: { system: string; request: string; tools: ToolSpec[] }): ModelConversation;
}

/** A provider failure with a sentence a person can read in the activity pane. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
