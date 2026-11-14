import { SCRIPTED_CLIENT, UNKNOWN_CLIENT } from "@/lib/http/client-app";

/** The id every call made without a key is logged under (ANONYMOUS_AGENT in src/lib/http/agent.ts). */
export const KEYLESS_AGENT_ID = "agent:anonymous";

/** The name such a caller is logged under when it gave none of its own. */
const KEYLESS_DEFAULT_NAME = "Unidentified agent";

/**
 * The client labels the server records, in words a buyer or a wholesaler reads without a glossary. The demo's own
 * scripted agent reads as a neutral "Laituri agent"; its exact label stays in the agent sheet's technical details.
 */
const CLIENT_NAMES: Record<string, string> = {
  curl: "Command line",
  [UNKNOWN_CLIENT]: "Unknown app",
  [SCRIPTED_CLIENT]: "Laituri agent",
};

/** "curl" -> "Command line", "Unknown client" -> "Unknown app", the scripted agent -> "Laituri agent"; any other app keeps its own name. */
export function clientName(client: string): string {
  return CLIENT_NAMES[client] ?? client;
}

export function isKeyless(agent: { id: string }): boolean {
  return agent.id === KEYLESS_AGENT_ID;
}

/** An agent as a list row names it: calls made without a key read "No key presented", or the name the caller gave. */
export function agentName(agent: { id: string; name: string }): string {
  if (!isKeyless(agent)) return agent.name;
  return agent.name === KEYLESS_DEFAULT_NAME ? "No key presented" : `${agent.name} · no key`;
}
