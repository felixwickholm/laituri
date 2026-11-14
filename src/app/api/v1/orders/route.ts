import { PlaceOrderRequest } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { resolveAgent } from "@/lib/http/agent";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request) => {
  const agent = await resolveAgent(request.headers);
  const headerKey = request.headers.get("idempotency-key")?.trim();
  const body = await readBody(request, PlaceOrderRequest, (raw) =>
    raw.idempotencyKey === undefined && headerKey ? { ...raw, idempotencyKey: headerKey } : raw,
  );
  const order = await gateway().placeOrder(agent, body);
  return json(order, { status: 201, headers: { location: `/api/v1/orders/${order.id}` } });
});

export const GET = route(async () => json({ orders: await gateway().listOrders() }));
