import { gateway } from "@/lib/gateway";
import { refuseAgents } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The wholesaler's view across every buyer. Agent credentials are refused: it holds other buyers' requests. */
export const GET = route(async (request) => {
  refuseAgents(request.headers);
  return json(await gateway().supplierOverview());
});
