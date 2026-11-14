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
    const { jws: mandateJws } = await (await mandate.GET(jsonRequest("/api/v1/mandate"))).json();

    const body = { offerJws: primary.jws, mandateJws };
    const place = () =>
      orders.POST(jsonRequest("/api/v1/orders", { body, headers: { ...auth, "idempotency-key": "flow-key-0001" } }));
    const first = await place();
    expect(first.status).toBe(201);
    const order = await first.json();
    expect(order.simulated).toBe(true);
    expect(order.agent.id).toBe("agent:harbour-purchasing");

    const again = await (await place()).json();
    expect(again.id).toBe(order.id);
  });

  it("blocks an order from an unidentified agent", async () => {
    const quote = await (await quotes.POST(jsonRequest("/api/v1/quotes", { body: EXAMPLES.quote.request }))).json();
    const { jws: mandateJws } = await (await mandate.GET(jsonRequest("/api/v1/mandate"))).json();
    const request = jsonRequest("/api/v1/orders", {
      body: { offerJws: quote.primary.jws, mandateJws, idempotencyKey: "anon-key-0001" },
      headers: { "x-agent-name": "Kitchen assistant" },
    });
    const order = await (await orders.POST(request)).json();
    expect(order.status).toBe("blocked");
    expect(order.agent.name).toBe("Kitchen assistant");
  });
});
