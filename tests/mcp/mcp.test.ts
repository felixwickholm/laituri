import { AGENT_TOKEN, jsonRequest } from "../http/env";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DELETE, GET, OPTIONS, POST } from "@/app/mcp/route";
import { gateway } from "@/lib/gateway";
import { BUYER_IDS } from "@/lib/mandate";

const PROTOCOL = "2025-06-18";
const hasCatalog = [".data/catalog.json", "fixtures/upstream/catalog.json"].some((file) => existsSync(path.resolve(file)));

let nextId = 1;
async function rpc(method: string, params: unknown = {}) {
  const request = jsonRequest("/mcp", {
    body: { jsonrpc: "2.0", id: nextId++, method, params },
    headers: { authorization: `Bearer ${AGENT_TOKEN}`, "mcp-protocol-version": PROTOCOL },
  });
  const response = await POST(request);
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  return { status: response.status, body: await response.json() };
}

describe("MCP server", () => {
  it("initializes with server instructions", async () => {
    const { status, body } = await rpc("initialize", {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(status).toBe(200);
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.instructions).toMatch(/place_order/);
  });

  it("lists the ordering tools with input and output schemas", async () => {
    const { body } = await rpc("tools/list");
    const tools = body.result.tools as { name: string; inputSchema: { type: string }; outputSchema: { type: string } }[];
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(
      ["get_mandate", "get_order", "get_product", "place_basket", "place_order", "request_quote", "search_catalog", "verify_audit"],
    ));
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.outputSchema.type).toBe("object");
    }
  });

  it("lets search_catalog rank by preference and describes the facts it returns", async () => {
    const { body } = await rpc("tools/list");
    type Tool = { name: string; description: string; inputSchema: { properties: Record<string, { enum?: string[] }> } };
    const search = (body.result.tools as Tool[]).find((t) => t.name === "search_catalog")!;
    expect(search.inputSchema.properties.prefer.enum).toEqual(["price", "reliability", "sustainability"]);
    expect(search.description).toMatch(/categoryAverageCo2PerKg \(a category average, not a product measurement\)/);
  });

  it("returns a tool error as a plain sentence", async () => {
    const { body } = await rpc("tools/call", { name: "get_order", arguments: { orderId: "ord-missing" } });
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toMatch(/ord-missing/);
  });

  it("returns the mandate as structured content and text", async () => {
    const { body } = await rpc("tools/call", { name: "get_mandate", arguments: {} });
    expect(body.result.structuredContent.mandate.agent.id).toBe("agent:harbour-purchasing");
    expect(body.result.content[0].text).toMatch(/Mandate JWS: /);
  });

  it.skipIf(!hasCatalog)("searches the catalogue", async () => {
    const { body } = await rpc("tools/call", { name: "search_catalog", arguments: { query: "laktoositon maito", limit: 3 } });
    expect(body.result.isError).not.toBe(true);
    expect(body.result.structuredContent.hits.length).toBeGreaterThan(0);
    expect(typeof body.result.content[0].text).toBe("string");
  });

  it("answers preflight and refuses GET and DELETE", async () => {
    expect((await OPTIONS()).status).toBe(204);
    expect((await GET()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });

  it("takes the agent key from the address when no header is sent", async () => {
    const call = (pathname: string) =>
      POST(jsonRequest(pathname, { body: { jsonrpc: "2.0", id: nextId++, method: "tools/list", params: {} } }));
    expect((await call(`/mcp?key=${AGENT_TOKEN}`)).status).toBe(200);
    expect((await call("/mcp?key=not-a-key")).status).toBe(401);
  });
});

describe("MCP callers", () => {
  const send = (token: string, method: string, params: unknown, userAgent: string) =>
    POST(jsonRequest("/mcp", {
      body: { jsonrpc: "2.0", id: nextId++, method, params },
      headers: { authorization: `Bearer ${token}`, "mcp-protocol-version": PROTOCOL, "user-agent": userAgent },
    }));

  it("gives each buyer's token its own mandate and names the client that initialized", async () => {
    const userAgent = "mcp-client-runtime/1";
    await send("demo-kaisla-token", "initialize", { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "claude-code", version: "2" } }, userAgent);
    const reply = await (await send("demo-kaisla-token", "tools/call", { name: "get_mandate", arguments: {} }, userAgent)).json();
    expect(reply.result.structuredContent.mandate.buyer.name).toBe("Kaisla School Kitchens");

    await send("demo-kaisla-token", "tools/call", { name: "get_product", arguments: { productId: "464306" } }, userAgent);
    const lookup = (await gateway().activity(undefined, BUYER_IDS.kaisla)).findLast((item) => item.tool === "get_product");
    expect(lookup).toMatchObject({ client: "Claude Code", buyer: { name: "Kaisla School Kitchens" } });
  });
});
