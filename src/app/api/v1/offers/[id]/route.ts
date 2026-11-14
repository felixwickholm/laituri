import { NotFoundError } from "@/lib/gateway";
import { resolveAgent, restCall } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The gateway has no offer lookup; offers are read straight from the store.
export const GET = route(async (request, params) => {
  await resolveAgent(request.headers, restCall(request));
  const signed = await store().offers.get(params.id);
  if (!signed) throw new NotFoundError(`Offer ${params.id} does not exist.`);
  return json(signed);
});
