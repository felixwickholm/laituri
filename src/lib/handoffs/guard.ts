import { appendAudit } from "@/lib/audit";
import { presentedCredential } from "@/lib/http/credential";
import { hasStatus } from "@/lib/gateway/errors";
import type { Operator } from "@/lib/gateway/types";
import { ANONYMOUS_AGENT, DEMO_AGENT_NAME, ForbiddenError, bearerToken } from "@/lib/http/agent";
import { operatorSession } from "@/lib/http/operator-session";
import { DEMO_VIA } from "@/lib/http/sign-in";

async function requireOperator(headers: Headers): Promise<Operator> {
  if (bearerToken(headers)) throw new ForbiddenError("Agents cannot answer for Valio Aimo.", "agent_not_allowed");
  const session = await operatorSession(headers);
  if (!session.signedIn || !session.operator) throw new ForbiddenError("Sign in as the Valio Aimo operator to answer.", "operator_sign_in_required");
  return { ...session.operator, ...(session.demo ? { via: DEMO_VIA } : {}) };
}

/** Only a signed-in wholesaler operator answers a kitchen; any other caller is refused and the refusal is logged. */
export async function guardHandoffOperator(headers: Headers, handoffId: string): Promise<Operator> {
  try {
    return await requireOperator(headers);
  } catch (error) {
    if (hasStatus(error, 403) && (await presentedCredential(headers))) {
      const byAgent = bearerToken(headers) !== undefined;
      await appendAudit({
        actor: { type: "agent", id: byAgent ? "agent:token" : ANONYMOUS_AGENT.id, name: byAgent ? DEMO_AGENT_NAME : ANONYMOUS_AGENT.name },
        event: "access.refused",
        summary: `${byAgent ? DEMO_AGENT_NAME : "A caller without an operator session"} tried to answer hand-off ${handoffId}. Refused: only a signed-in operator can.`,
        data: { action: "handoff.answer", handoffId, code: error.code },
      });
    }
    throw error;
  }
}
