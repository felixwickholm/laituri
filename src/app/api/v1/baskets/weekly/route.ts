import { startBasket, weeklyRequest } from "@/lib/basket";
import { basketCaller } from "@/lib/basket/caller";
import { basketIdempotencyKey, startOnce } from "@/lib/basket/idempotency";
import { weeklyDeliverBy } from "@/lib/basket/weekly";
import { now } from "@/lib/clock";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Starts this buyer's standing weekly order for next Monday. A repeat with the same Idempotency-Key gets the first basket. */
export const POST = route(async (request) => {
  const agent = await basketCaller(request);
  const key = basketIdempotencyKey(request.headers);
  const deliverBy = weeklyDeliverBy(now());
  const basketId = await startOnce(agent.buyer.id, key, { weekly: deliverBy }, async () => (await startBasket(weeklyRequest(agent.buyer.id, deliverBy), agent)).basket.id);
  return json({ basketId }, { status: 202, headers: { location: `/api/v1/baskets/${basketId}` } });
});
