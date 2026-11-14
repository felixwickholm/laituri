import { gateway } from "@/lib/gateway";
import { resolveAgent } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request, params) => {
  const agent = await resolveAgent(request.headers);
  return json(await gateway().getOrder(agent, params.id));
});
