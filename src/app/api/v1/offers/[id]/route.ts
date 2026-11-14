import { NotFoundError } from "@/lib/gateway";
import { route } from "@/lib/http/handler";
import { readingAgent } from "@/lib/http/reader";
import { json } from "@/lib/http/respond";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The gateway has no offer lookup; offers are read straight from the store.
// For an agent token, an offer made for another buyer does not exist; a browser in its sandbox or a person sees any offer.
export const GET = route(async (request, params) => {
  const agent = await readingAgent(request, "an offer");
  const signed = await store().offers.get(params.id);
  const otherBuyer = agent.buyer !== undefined && signed?.offer.buyer.id !== agent.buyer.id;
  if (!signed || otherBuyer) throw new NotFoundError(`Offer ${params.id} does not exist.`);
  return json(signed);
});
