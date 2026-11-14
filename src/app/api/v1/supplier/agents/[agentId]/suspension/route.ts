import { SuspensionRequest } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { refuseAgents } from "@/lib/http/agent";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The wholesaler suspends or resumes one agent. Like the other demo controls it is open to console visitors and
 * refuses agent credentials; production puts it behind the wholesaler's own sign-in.
 */
export const POST = route(async (request, params) => {
  refuseAgents(request.headers);
  const body = await readBody(request, SuspensionRequest);
  return json(await gateway().setAgentSuspension(params.agentId, body));
});
