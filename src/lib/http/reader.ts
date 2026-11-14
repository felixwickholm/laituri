import { GatewayError } from "@/lib/gateway/errors";
import { bearerToken, resolveAgent, restCall, type AgentIdentity } from "./agent";
import { sessionClaims } from "./session-token";
import { resolveWorkspace } from "./workspace";

/**
 * Who reads a workspace's records. "agent": a known agent token, limited to its own buyer.
 * "full": a browser in its own sandbox, or a signed-in approver or operator of this workspace.
 */
export type Reader = { kind: "agent"; buyerId: string } | { kind: "full" };

export class CredentialRequiredError extends GatewayError {
  constructor(what: string) {
    super(
      `Reading ${what} needs an agent key, your browser's sandbox or a signed-in session. Create a sandbox with POST /api/v1/workspace and use one of its keys.`,
      401,
      "credential_required",
    );
  }
}

/** A browser in its own sandbox, or a person signed in to this workspace. A shared-view cookie alone is not access. */
export async function fullAccess(request: Request): Promise<boolean> {
  const { access } = await resolveWorkspace(request.headers);
  if (access === "browser") return true;
  const [approver, operator] = await Promise.all([sessionClaims(request.headers, "approver"), sessionClaims(request.headers, "operator")]);
  return Boolean(approver || operator);
}

/**
 * The reader of a request, or 401 for a caller without a credential. A browser looking at the shared workspace has
 * no sandbox there, and anyone can set that cookie, so it reads only with a session for the shared workspace.
 */
export async function requireReader(request: Request, what: string): Promise<Reader> {
  if (bearerToken(request.headers)) {
    const agent = await resolveAgent(request.headers, restCall(request));
    if (agent.buyer) return { kind: "agent", buyerId: agent.buyer.id };
  }
  if (await fullAccess(request)) return { kind: "full" };
  throw new CredentialRequiredError(what);
}

/** The caller of a read that goes through the gateway as an agent call: a token's agent, else a full reader, else 401. */
export async function readingAgent(request: Request, what: string): Promise<AgentIdentity> {
  const agent = await resolveAgent(request.headers, restCall(request));
  if (agent.buyer || (await fullAccess(request))) return agent;
  throw new CredentialRequiredError(what);
}
