import type { Health } from "../types";

const ENGINE_NAMES = { scripted: "scripted", gemini: "Gemini", claude: "Claude" } as const;

export interface EngineLine {
  text: string;
  /** The model name, when a live model runs typed requests. */
  model?: string;
}

/** Which engine answers a typed request, as the server reports it; undefined until health has arrived. */
export function engineLine(health: Health | undefined): EngineLine | undefined {
  const agent = health?.agent;
  if (!agent) return undefined;
  return { text: `Agent engine: ${ENGINE_NAMES[agent.engine]}`, ...(agent.model ? { model: agent.model } : {}) };
}
