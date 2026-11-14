import { AGENT_TOKEN, jsonRequest } from "../http/env";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DELETE, GET, OPTIONS, POST } from "@/app/mcp/route";

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

  it("lists seven tools with input and output schemas", async () => {
    const { body } = await rpc("tools/list");
    const tools = body.result.tools as { name: string; inputSchema: { type: string }; outputSchema: { type: string } }[];
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["get_mandate", "get_order", "get_product", "place_order", "request_quote", "search_catalog", "verify_audit"],
    );
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.outputSchema.type).toBe("object");
    }
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
});
