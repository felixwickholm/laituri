import { SuspensionRequest } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { readBody, route } from "@/lib/http/handler";
import { guardOperator } from "@/lib/http/operator-session";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A signed-in wholesaler operator suspends or resumes one agent. Anyone else, an agent included, is refused with 403
 * and the attempt is logged.
 */
export const POST = route(async (request, params) => {
  const operator = await guardOperator(request.headers, params.agentId);
  const body = await readBody(request, SuspensionRequest);
  return json(await gateway().setAgentSuspension(params.agentId, body, operator));
});
