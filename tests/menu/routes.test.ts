import { AGENT_TOKEN, jsonRequest, params } from "../http/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as plan from "@/app/api/v1/menus/plan/route";
import * as pantry from "@/app/api/v1/pantry/route";
import * as search from "@/app/api/v1/products/search/route";
import * as recipe from "@/app/api/v1/recipes/[id]/route";
import * as recipes from "@/app/api/v1/recipes/route";
import * as session from "@/app/api/v1/console/session/route";
import * as suggestions from "@/app/api/v1/suggestions/route";
import * as suspension from "@/app/api/v1/supplier/agents/[agentId]/suspension/route";
import { POST as mcp } from "@/app/mcp/route";
import { MenuPlan, PantryList, Recipe, RecipeList, SuggestionList } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { store } from "@/lib/store";
import { RECIPES } from "@/lib/recipes";

const harbour = { authorization: `Bearer ${AGENT_TOKEN}` };
const kaisla = { authorization: "Bearer demo-kaisla-token" };

const planAs = (headers: Record<string, string>, body: unknown = { words: "Dinner for 80 on Friday, no nuts" }) =>
  plan.POST(jsonRequest("/api/v1/menus/plan", { body, headers }));

function mcpCall(name: string, args: Record<string, unknown>, headers: Record<string, string>) {
  return mcp(jsonRequest("/mcp", {
    body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
    headers: { ...headers, "mcp-protocol-version": "2025-06-18" },
  }));
}

/** An agent can be suspended once it has reached the wholesaler: a search does that. */
async function suspendHarbour(): Promise<void> {
  await search.POST(jsonRequest("/api/v1/products/search", { body: { query: "milk" }, headers: harbour }));
  const signIn = await session.POST(jsonRequest("/api/v1/console/session", { body: { role: "operator" } }));
  const cookie = signIn.headers.get("set-cookie")!.split(";")[0];
  const agentId = "agent:harbour-purchasing";
  const url = `/api/v1/supplier/agents/${encodeURIComponent(agentId)}/suspension`;
  const response = await suspension.POST(jsonRequest(url, { body: { suspended: true }, headers: { cookie } }), params({ agentId }));
  expect(response.status).toBe(200);
}

beforeEach(async () => {
  await gateway().reset();
});

describe("menu routes", () => {
  it("plans a menu for the calling agent's buyer", async () => {
    const response = await planAs(harbour);
    expect(response.status).toBe(200);
    const body = MenuPlan.parse(await response.json());
    expect(body.understood).toBe("A dinner for 80 guests on Friday 20 Nov, no nuts.");
    expect(body.menus).toHaveLength(3);
  });

  it("plans under the school kitchen's own mandate for its key", async () => {
    const body = MenuPlan.parse(await (await planAs(kaisla, { guests: 120, date: "2026-11-19", occasion: "school lunch" })).json());
    for (const menu of body.menus) {
      expect(menu.fits).toContainEqual(
        menu.unpriced
          ? { ok: false, sentence: "Every matched product meets your allergen rules. Check the open ingredients." }
          : { ok: true, sentence: "Every product meets your allergen rules." },
      );
    }
  });

  it("answers 401 without a credential and 400 for a request it cannot read", async () => {
    expect((await planAs({})).status).toBe(401);
    const bad = await planAs(harbour, { guests: "many" });
    expect(bad.status).toBe(400);
    const vague = await planAs(harbour, { words: "School lunch, no nuts or sesame" });
    expect(vague.status).toBe(200);
    expect(await vague.json()).toMatchObject({ needs: ["guests"], question: "How many guests?", menus: [] });
  });

  it("serves the recipe library to anyone", async () => {
    const list = RecipeList.parse(await (await recipes.GET(jsonRequest("/api/v1/recipes"))).json());
    expect(list.recipes).toHaveLength(RECIPES.length);
    const one = await recipe.GET(jsonRequest("/api/v1/recipes/cream-cake"), params({ id: "cream-cake" }));
    expect(Recipe.parse(await one.json()).name).toBe("Cream cake (kermakakku)");
    expect((await recipe.GET(jsonRequest("/api/v1/recipes/nope"), params({ id: "nope" }))).status).toBe(404);
  });

  it("shows each kitchen only its own stock", async () => {
    const own = PantryList.parse(await (await pantry.GET(jsonRequest("/api/v1/pantry", { headers: kaisla }))).json());
    expect(own.items).toContainEqual({ words: "potatoes", amount: 40, unit: "kg" });
    expect((await pantry.GET(jsonRequest("/api/v1/pantry"))).status).toBe(401);
    expect((await pantry.GET(jsonRequest("/api/v1/pantry?buyer=fi:ovt:003723456789", { headers: harbour }))).status).toBe(403);
  });

  it("suggests at most four things for the buyer", async () => {
    const body = SuggestionList.parse(await (await suggestions.GET(jsonRequest("/api/v1/suggestions", { headers: harbour }))).json());
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions[0]).toMatchObject({ kind: "event", action: { type: "plan_menu" } });
  });

  it("still suggests when the weekly draft cannot be read", async () => {
    const list = vi.spyOn(store().baskets, "list").mockRejectedValue(new Error("no baskets here"));
    const response = await suggestions.GET(jsonRequest("/api/v1/suggestions", { headers: harbour }));
    list.mockRestore();
    expect(response.status).toBe(200);
    const kinds = SuggestionList.parse(await response.json()).suggestions.map((suggestion) => suggestion.kind);
    expect(kinds).toContain("event");
    expect(kinds).not.toContain("weekly_due");
  });

  it("plans and lists recipes over MCP, for the key's buyer", async () => {
    const planned = await (await mcpCall("plan_menu", { words: "We have a wedding on Saturday with 80 guests. Three courses." }, harbour)).json();
    const structured = MenuPlan.parse(planned.result.structuredContent);
    expect(structured.menus.some((menu) => menu.id.startsWith("menu:three_course:"))).toBe(true);
    expect(planned.result.content[0].text).toMatch(/^A wedding for 80 guests on Saturday 21 Nov, three courses\./);
    const listed = await (await mcpCall("list_recipes", {}, harbour)).json();
    expect(RecipeList.parse(listed.result.structuredContent).recipes.length).toBe(RECIPES.length);
    const anonymous = await (await mcpCall("plan_menu", { words: "Dinner for 8 on Friday" }, {})).json();
    expect(anonymous.result.isError).toBe(true);
  });

  it("refuses a suspended agent, over REST and MCP", async () => {
    await suspendHarbour();
    expect((await planAs(harbour)).status).toBe(403);
    const refused = await mcpCall("plan_menu", { words: "Dinner for 80 on Friday" }, harbour);
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe("agent_suspended");
    expect((await planAs(kaisla, { guests: 20, date: "2026-11-19" })).status).toBe(200);
  });
});
