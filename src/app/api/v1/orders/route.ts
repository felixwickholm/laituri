import { PlaceOrderRequest } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { resolveAgent, restCall } from "@/lib/http/agent";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { readBody, route } from "@/lib/http/handler";
import { orderResponse } from "@/lib/http/order-response";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request) => {
  const agent = await resolveAgent(request.headers, restCall(request));
  const headerKey = request.headers.get("idempotency-key")?.trim();
  const body = await readBody(request, PlaceOrderRequest, (raw) =>
    raw.idempotencyKey === undefined && headerKey ? { ...raw, idempotencyKey: headerKey } : raw,
  );
  return orderResponse(await gateway().placeOrder(agent, body));
});

export const GET = route(async (request) => json({ orders: await gateway().listOrders(await readerBuyer(request, "orders")) }));
