import { gateway } from "@/lib/gateway";
import { route } from "@/lib/http/handler";
import { readingAgent } from "@/lib/http/reader";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request, params) => {
  const agent = await readingAgent(request, "an order");
  return json(await gateway().getOrder(agent, params.id));
});
