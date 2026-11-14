import { AssistantTurnRequest } from "@/lib/contracts";
import { assistantTurnFor } from "@/lib/assistant/service";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The event assistant: the kitchen's words in, a short reply, what is still needed, and cards to act on. */
export const POST = route(async (request) => {
  const buyerId = await readerBuyer(request, "the event assistant");
  const body = await readBody(request, AssistantTurnRequest);
  return json(await assistantTurnFor(buyerId, body));
});
