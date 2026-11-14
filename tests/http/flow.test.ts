import { AGENT_TOKEN, jsonRequest } from "./env";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as mandate from "@/app/api/v1/mandate/route";
import * as orders from "@/app/api/v1/orders/route";
import * as quotes from "@/app/api/v1/quotes/route";
import { EXAMPLES } from "@/lib/openapi/examples";

const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));
const auth = { authorization: `Bearer ${AGENT_TOKEN}` };

describe.skipIf(!hasFixtures)("milk flow over REST", () => {
  it("quotes, orders and replays the same idempotency key", async () => {
    const quote = await quotes.POST(jsonRequest("/api/v1/quotes", { body: EXAMPLES.quote.request, headers: auth }));
    expect(quote.status).toBe(200);
    const { primary } = await quote.json();
    const { jws: mandateJws } = await (await mandate.GET(jsonRequest("/api/v1/mandate", { headers: auth }))).json();

    const body = { offerJws: primary.jws, mandateJws };
    const place = () =>
      orders.POST(jsonRequest("/api/v1/orders", { body, headers: { ...auth, "idempotency-key": "flow-key-0001" } }));
    const first = await place();
    expect(first.status).toBe(201);
    const order = await first.json();
    expect(order.simulated).toBe(true);
    expect(order.agent.id).toBe("agent:harbour-purchasing");

    const replay = await place();
    expect(replay.status).toBe(201);
    expect((await replay.json()).id).toBe(order.id);
  });

  it("answers 202 for an order that waits for a person, and again on a replay", async () => {
    const line = { ...EXAMPLES.quote.request.lines[0], quantity: { amount: 3000, unit: "l" } };
    const request = { ...EXAMPLES.quote.request, lines: [line], intent: "3000 litres of lactose-free milk" };
    const { primary } = await (await quotes.POST(jsonRequest("/api/v1/quotes", { body: request, headers: auth }))).json();
    const { jws: mandateJws } = await (await mandate.GET(jsonRequest("/api/v1/mandate", { headers: auth }))).json();
    const place = () =>
      orders.POST(jsonRequest("/api/v1/orders", { body: { offerJws: primary.jws, mandateJws, idempotencyKey: "pending-key-0001" }, headers: auth }));
    const first = await place();
    expect(first.status).toBe(202);
    const order = await first.json();
    expect(order.status).toBe("pending_approval");
    expect(first.headers.get("location")).toBe(`/api/v1/orders/${order.id}`);
    expect((await place()).status).toBe(202);
  });

  it("blocks an order from an unidentified agent", async () => {
    const quote = await (await quotes.POST(jsonRequest("/api/v1/quotes", { body: EXAMPLES.quote.request }))).json();
    const { jws: mandateJws } = await (await mandate.GET(jsonRequest("/api/v1/mandate", { headers: auth }))).json();
    const place = () =>
      orders.POST(jsonRequest("/api/v1/orders", {
        body: { offerJws: quote.primary.jws, mandateJws, idempotencyKey: "anon-key-0001" },
        headers: { "x-agent-name": "Kitchen assistant" },
      }));
    const response = await place();
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const problem = await response.json();
    expect(problem).toMatchObject({ status: 422, code: "order_blocked", title: "Order blocked" });
    expect(problem.detail).toMatch(/^The order was blocked: .+\.$/);
    expect(response.headers.get("location")).toBe(`/api/v1/orders/${problem.order.id}`);
    expect(problem.order.status).toBe("blocked");
    expect(problem.order.agent.name).toBe("Kitchen assistant");
    const failed = problem.order.decision.checks.filter((check: { status: string }) => check.status === "block");
    expect(failed.length).toBeGreaterThan(0);
    for (const check of failed) expect(problem.detail).toContain(check.message.replace(/\.$/, ""));
    expect((await place()).status).toBe(422);
  });
});
