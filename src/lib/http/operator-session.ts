import { appendAudit } from "@/lib/audit";
import { hasStatus } from "@/lib/gateway/errors";
import type { Operator } from "@/lib/gateway/types";
import { ISSUER } from "@/lib/offers/assemble";
import { ANONYMOUS_AGENT, DEMO_AGENT_NAME, ForbiddenError, bearerToken } from "./agent";
import { DEMO_VIA, checkPasscode, requireDemoAccess, signInMode, type SignInMode } from "./sign-in";
import { sessionClaims, sessionCookie } from "./session-token";

/** The wholesaler side of the console: who may suspend and resume agents. */
export interface OperatorSession {
  signedIn: boolean;
  operator?: { id: string; name: string };
  demo?: boolean;
  /** How an operator signs in here (LAITURI_OPERATOR_PASSCODE). */
  mode: SignInMode;
}

const OPERATOR_ID = "operator:valio-aimo";
const OPERATOR_NAME = `${ISSUER} operator`;
const DEMO_OPERATOR_NAME = `${OPERATOR_NAME} (demo access)`;

export async function operatorSession(headers: Headers): Promise<OperatorSession> {
  const claims = await sessionClaims(headers, "operator");
  const mode = signInMode("operator");
  if (!claims) return { signedIn: false, mode };
  return { signedIn: true, operator: { id: claims.sub, name: claims.name }, demo: claims.demo === true, mode };
}

/** Signs in the wholesaler's operator with LAITURI_OPERATOR_PASSCODE. */
export function signInOperator(given: string | undefined): Promise<string> {
  checkPasscode("operator", given);
  return sessionCookie({ role: "operator", sub: OPERATOR_ID, name: OPERATOR_NAME });
}

/** One-click demo access to the wholesaler side, in the visitor's own sandbox only. */
export function signInOperatorDemo(): Promise<string> {
  requireDemoAccess();
  return sessionCookie({ role: "operator", sub: OPERATOR_ID, name: DEMO_OPERATOR_NAME, demo: true });
}

async function requireOperator(headers: Headers): Promise<Operator> {
  if (bearerToken(headers)) throw new ForbiddenError("Agents cannot suspend or resume agents.", "agent_not_allowed");
  const session = await operatorSession(headers);
  if (!session.signedIn || !session.operator) {
    throw new ForbiddenError(`Sign in as the ${OPERATOR_NAME} to suspend or resume an agent.`, "operator_sign_in_required");
  }
  return { ...session.operator, ...(session.demo ? { via: DEMO_VIA } : {}) };
}

/**
 * The guard for wholesaler controls. No session, an approver's session or any agent credential (a suspended agent's
 * included) is refused, and each refusal is a signed audit entry.
 */
export async function guardOperator(headers: Headers, agentId: string): Promise<Operator> {
  try {
    return await requireOperator(headers);
  } catch (error) {
    if (hasStatus(error, 403)) {
      const byAgent = bearerToken(headers) !== undefined;
      const who = byAgent ? DEMO_AGENT_NAME : "A caller without an operator session";
      await appendAudit({
        actor: { type: "agent", id: byAgent ? "agent:token" : ANONYMOUS_AGENT.id, name: byAgent ? DEMO_AGENT_NAME : ANONYMOUS_AGENT.name },
        event: "access.refused",
        summary: `${who} tried to suspend or resume ${agentId}. Refused: only a signed-in ${OPERATOR_NAME} can.`,
        data: { action: "suspension", agentId, code: error.code },
      });
    }
    throw error;
  }
}
