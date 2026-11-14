import { AGENT_TOKEN, jsonRequest } from "./env";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as overview from "@/app/api/v1/supplier/overview/route";
import * as quotes from "@/app/api/v1/quotes/route";
import * as search from "@/app/api/v1/products/search/route";
import { SupplierOverview } from "@/lib/contracts";
import { MILK } from "@/lib/openapi/examples";

const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));

describe("supplier overview route", () => {
  it("refuses agent credentials", async () => {
    const response = await overview.GET(jsonRequest("/api/v1/supplier/overview", { headers: { authorization: `Bearer ${AGENT_TOKEN}` } }));
    expect(response.status).toBe(403);
  });

  it.skipIf(!hasFixtures)("shows what reached the wholesaler, with the client application that sent it", async () => {
    const headers = { authorization: "Bearer demo-laine-token", "user-agent": "curl/8.7.1" };
    await search.POST(jsonRequest("/api/v1/products/search", { body: { query: "unobtainium" }, headers }));
    await quotes.POST(jsonRequest("/api/v1/quotes", {
      body: { lines: [{ productId: MILK.productId, quantity: { amount: 20, unit: "l" } }], deliverBy: MILK.deliverBy, intent: "20 litres of milk" },
      headers,
    }));
    const body = await (await overview.GET(jsonRequest("/api/v1/supplier/overview"))).json();
    const parsed = SupplierOverview.parse(body);
    const laine = parsed.agents.find((agent) => agent.agent.id === "agent:laine-kitchen-assistant");
    expect(laine).toMatchObject({ buyer: { name: "Ravintola Laine" }, clients: ["curl"], quotes: 1 });
    expect(parsed.unmet.find((r) => r.words === "unobtainium")).toMatchObject({ reason: "not_found", client: "curl" });
    expect(parsed.demand.topConcepts.find((c) => c.concept === "milk")?.quantity).toEqual([{ amount: 20, unit: "l" }]);
    expect(JSON.stringify(body)).not.toMatch(/perOrder|excludeAllergens|approver/);
  });
});
