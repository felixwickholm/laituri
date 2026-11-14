import { claudeProvider } from "./claude";
import { geminiProvider } from "./gemini";
import type { AgentEngine, ModelProvider } from "./types";

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

type Env = Record<string, string | undefined>;

export interface EngineChoice {
  engine: AgentEngine;
  model?: string;
  /** Set when a model engine was asked for but cannot run, for example because its key is missing. */
  unavailable?: string;
}

const ENGINES = ["auto", "claude", "gemini", "scripted"] as const;
type EngineSetting = (typeof ENGINES)[number];

function value(env: Env, name: string): string | undefined {
  return env[name]?.trim() || undefined;
}

function claude(env: Env): EngineChoice {
  return { engine: "claude", model: value(env, "LAITURI_CLAUDE_MODEL") ?? DEFAULT_CLAUDE_MODEL };
}

function gemini(env: Env): EngineChoice {
  return { engine: "gemini", model: value(env, "LAITURI_GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL };
}

/**
 * Which engine runs free-text requests. LAITURI_AGENT_ENGINE is auto (default), claude, gemini or scripted.
 * auto takes Claude when ANTHROPIC_API_KEY is set, else Gemini when GEMINI_API_KEY is set, else the scripted agent.
 */
export function selectEngine(env: Env = process.env): EngineChoice {
  const raw = value(env, "LAITURI_AGENT_ENGINE")?.toLowerCase() ?? "auto";
  if (!(ENGINES as readonly string[]).includes(raw)) {
    return { engine: "scripted", unavailable: `LAITURI_AGENT_ENGINE "${raw}" is not one of ${ENGINES.join(", ")}.` };
  }
  const setting = raw as EngineSetting;
  const hasClaude = value(env, "ANTHROPIC_API_KEY") !== undefined;
  const hasGemini = value(env, "GEMINI_API_KEY") !== undefined;
  if (setting === "scripted") return { engine: "scripted" };
  if (setting === "claude") return hasClaude ? claude(env) : { engine: "scripted", unavailable: "ANTHROPIC_API_KEY is not set." };
  if (setting === "gemini") return hasGemini ? gemini(env) : { engine: "scripted", unavailable: "GEMINI_API_KEY is not set." };
  if (hasClaude) return claude(env);
  if (hasGemini) return gemini(env);
  return { engine: "scripted" };
}

/** The provider for a model engine. Keys are read here and passed to the provider only, never to the model. */
export function providerFor(choice: EngineChoice, env: Env = process.env): ModelProvider | undefined {
  if (choice.engine === "claude" && choice.model) {
    return claudeProvider({ apiKey: value(env, "ANTHROPIC_API_KEY") ?? "", model: choice.model });
  }
  if (choice.engine === "gemini" && choice.model) {
    return geminiProvider({ apiKey: value(env, "GEMINI_API_KEY") ?? "", model: choice.model });
  }
  return undefined;
}
