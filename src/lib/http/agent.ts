import { gateway } from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway/errors";
import { BUYER_IDS, currentMandate } from "@/lib/mandate";
import { sandboxes } from "@/lib/workspace";
import { currentWorkspace } from "@/lib/workspace/context";
import { clientLabel } from "./client-app";

export interface AgentIdentity {
  id: string;
  name: string;
  /** The buyer whose token was presented. */
  buyer?: { id: string; name: string };
  /** The client application that made the call. */
  client: string;
}

/** Name shown when a refusal is logged for a token holder before its mandate is read. */
export const DEMO_AGENT_NAME = "An agent with a token";

export const ANONYMOUS_AGENT = { id: "agent:anonymous", name: "Unidentified agent" } as const;

/**
 * Fixed demo bearer tokens for the shared workspace, one per buyer, each naming the agent in that buyer's mandate.
 * Each sandbox has its own random keys instead (see sandboxes()). Production uses OAuth 2.1.
 */
export const DEMO_TOKENS: Record<string, string> = {
  "demo-agent-token": BUYER_IDS.nordicHarbour,
  "demo-kaisla-token": BUYER_IDS.kaisla,
  "demo-laine-token": BUYER_IDS.laine,
};

/** The buyer a token stands for in the current workspace; a key from another workspace stands for nobody here. */
function tokenBuyer(token: string): string | undefined {
  const workspace = currentWorkspace();
  if (workspace.kind === "shared") return DEMO_TOKENS[token];
  const keyed = sandboxes().byAgentKey(token);
  return keyed?.workspace === workspace ? keyed.buyerId : undefined;
}

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

/** A REST call as the audit log names it: "POST /api/v1/quotes". */
export function restCall(request: Request): string {
  return `${request.method} ${new URL(request.url).pathname}`;
}

async function identify(headers: Headers, mcpClient?: string): Promise<AgentIdentity> {
  const client = clientLabel({ mcp: mcpClient, header: headers.get("x-agent-client") ?? undefined, userAgent: headers.get("user-agent") ?? undefined });
  const token = bearerToken(headers);
  if (token) {
    const buyerId = tokenBuyer(token);
    if (!buyerId) throw new UnauthorizedError("The bearer token is not known.");
    const { mandate } = await currentMandate(buyerId);
    return { ...mandate.agent, buyer: { id: mandate.buyer.id, name: mandate.buyer.name }, client };
  }
  const name = headers.get("x-agent-name")?.trim().slice(0, 80);
  return { ...ANONYMOUS_AGENT, ...(name ? { name } : {}), client };
}

/**
 * Who is calling. A known token maps to the agent named in its buyer's mandate.
 * No token means an anonymous agent; X-Agent-Name gives it a readable name.
 * An agent the wholesaler has suspended is refused here, whatever it calls; `call` names the call for the audit log.
 * `mcpClient` is the client name an MCP client reported when it connected.
 */
export async function resolveAgent(headers: Headers, call: string, mcpClient?: string): Promise<AgentIdentity> {
  const agent = await identify(headers, mcpClient);
  await gateway().admitAgent(agent, call);
  return agent;
}

/**
 * A suspended agent's credential is refused on every route, public documents included, and the refusal is logged.
 * A call without a token, or with a token the service does not know, is left to the route.
 */
export async function refuseSuspendedCredential(request: Request): Promise<void> {
  const token = bearerToken(request.headers);
  if (token && tokenBuyer(token)) await resolveAgent(request.headers, restCall(request));
}

/** Demo controls (start a scene, suspend an agent) are open to visitors but never to an agent credential. */
export function refuseAgents(headers: Headers): void {
  if (bearerToken(headers)) {
    throw new ForbiddenError("Agents cannot use the console controls.", "agent_not_allowed");
  }
}
