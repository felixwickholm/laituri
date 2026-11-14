import { AGENT_TOKEN, jsonRequest } from "../http/env";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/mcp/route";
import { Basket } from "@/lib/contracts";
import { BUYER_IDS } from "@/lib/mandate";

process.env.LAITURI_DEMO_STEP_MS = "0";

const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));

async function callTool(name: string, args: unknown, token = AGENT_TOKEN) {
  const request = jsonRequest("/mcp", {
    body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
    headers: { authorization: `Bearer ${token}`, "mcp-protocol-version": "2025-06-18" },
  });
  return (await (await POST(request)).json()) as { result: { isError?: boolean; structuredContent?: unknown; content: { text: string }[] } };
}

describe.skipIf(!hasFixtures)("the place_basket tool", () => {
  it("orders every line as the key's buyer and answers with each line's state and reason", async () => {
    const { result } = await callTool("place_basket", {
      deliverBy: "2026-11-16",
      lines: [
        { words: "lactose-free milk", quantity: { amount: 200, unit: "l" } },
        { words: "Alpro almond drink", quantity: { amount: 40, unit: "l" }, productId: "461360" },
      ],
    });
    expect(result.isError).toBeUndefined();
    const basket = Basket.parse(result.structuredContent);
    expect(basket).toMatchObject({ status: "done", source: "agent", buyer: { id: BUYER_IDS.nordicHarbour } });
    expect(basket.lines.map((line) => line.state)).toEqual(["green", "red"]);
    expect(result.content[0].text).toContain("Alpro almond drink: not ordered. Contains nuts. Your rules say no.");
    expect(result.content[0].text).toContain("Tell your human which lines need them.");
  });

  it("refuses invalid input with a plain message", async () => {
    const { result } = await callTool("place_basket", { deliverBy: "Monday", lines: [] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not valid/);
  });

  it("is listed as a tool that changes state", async () => {
    const request = jsonRequest("/mcp", {
      body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      headers: { authorization: `Bearer ${AGENT_TOKEN}`, "mcp-protocol-version": "2025-06-18" },
    });
    const { result } = (await (await POST(request)).json()) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } };
    expect(result.tools.find((tool) => tool.name === "place_basket")?.annotations.readOnlyHint).toBe(false);
  });
});
