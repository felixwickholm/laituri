import { GatewayError } from "@/lib/gateway/errors";
import { currentMandate } from "@/lib/mandate";

export interface AgentIdentity {
  id: string;
  name: string;
}

/** Name shown when a refusal is logged for a token holder before its mandate is read. */
export const DEMO_AGENT_NAME = "An agent with a token";

export const ANONYMOUS_AGENT: AgentIdentity = { id: "agent:anonymous", name: "Unidentified agent" };

/** Demo bearer tokens. Production replaces these with OAuth 2.1 access tokens. */
const DEMO_TOKENS: Record<string, "mandate-agent"> = {
  "demo-agent-token": "mandate-agent",
};

export class UnauthorizedError extends GatewayError {
  constructor(message: string) {
    super(message, 401, "unknown_token");
  }
}

export class ForbiddenError extends GatewayError {
  constructor(message: string, code = "forbidden") {
    super(message, 403, code);
  }
}

export function bearerToken(headers: Headers): string | undefined {
  const value = headers.get("authorization");
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1].trim() || undefined;
}

/**
 * Who is calling. A known token maps to the agent named in the mandate.
 * No token means an anonymous agent; X-Agent-Name gives it a readable name.
 */
export async function resolveAgent(headers: Headers): Promise<AgentIdentity> {
  const token = bearerToken(headers);
  if (token) {
    if (!DEMO_TOKENS[token]) throw new UnauthorizedError("The bearer token is not known.");
    const { mandate } = await currentMandate();
    return mandate.agent;
  }
  const name = headers.get("x-agent-name")?.trim().slice(0, 80);
  return name ? { ...ANONYMOUS_AGENT, name } : ANONYMOUS_AGENT;
}

/** Demo controls (start a scene, reset) are open to visitors but never to an agent credential. */
export function refuseAgents(headers: Headers): void {
  if (bearerToken(headers)) {
    throw new ForbiddenError("Agents cannot use the console controls.", "agent_not_allowed");
  }
}
