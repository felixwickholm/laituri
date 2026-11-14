import { gateway } from "@/lib/gateway";
import { resolveAgent, restCall } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request, params) => {
  const agent = await resolveAgent(request.headers, restCall(request));
  return json(await gateway().getProduct(agent, params.id));
});
