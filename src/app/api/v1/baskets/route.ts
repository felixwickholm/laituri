import { CreateBasketRequest } from "@/lib/contracts";
import { startBasket } from "@/lib/basket";
import { basketCaller, basketsFor } from "@/lib/basket/caller";
import { basketIdempotencyKey, startOnce } from "@/lib/basket/idempotency";
import { bearerToken } from "@/lib/http/agent";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The buyer's agent starts working the lines at once; poll GET /api/v1/baskets/{id} to watch them turn colour.
 * An agent key makes an agent basket, as place_basket does over MCP; it may say the lines came from a menu, never that
 * the purchasing manager typed them (manual) or that they are the standing weekly order. A repeat with the same
 * Idempotency-Key answers with the first basket instead of ordering twice.
 */
export const POST = route(async (request) => {
  const agent = await basketCaller(request);
  const key = basketIdempotencyKey(request.headers);
  const body = await readBody(request, CreateBasketRequest);
  const source = bearerToken(request.headers) ? (body.source === "menu" ? "menu" : "agent") : (body.source ?? "manual");
  const basketId = await startOnce(agent.buyer.id, key, { ...body, source }, async () => (await startBasket({ ...body, source }, agent)).basket.id);
  return json({ basketId }, { status: 202, headers: { location: `/api/v1/baskets/${basketId}` } });
});

export const GET = route(async (request) => json({ baskets: await basketsFor(request) }));
