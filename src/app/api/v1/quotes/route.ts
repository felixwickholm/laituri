import { QuoteRequest } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { resolveAgent, restCall } from "@/lib/http/agent";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request) => {
  const agent = await resolveAgent(request.headers, restCall(request));
  const body = await readBody(request, QuoteRequest);
  return json(await gateway().requestQuote(agent, body));
});
