import { weeklyDraft } from "@/lib/basket";
import { now } from "@/lib/clock";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** This week's standing order before it starts: last week's quantities, what changed, and the drift of recent weeks. */
export const GET = route(async (request) => {
  const buyerId = await readerBuyer(request, "the weekly order");
  return json(weeklyDraft(buyerId, await store().baskets.list(), now()));
});
