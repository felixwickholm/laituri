import { AGENT_TOKEN, jsonRequest } from "./env";
import { describe, expect, it } from "vitest";
import * as orders from "@/app/api/v1/orders/route";
import * as workspace from "@/app/api/v1/workspace/route";
import type { WorkspaceInfo } from "@/lib/contracts";
import { WORKSPACE_COOKIE } from "@/lib/workspace/cookie";

process.env.LAITURI_SANDBOX_CREATE_PER_10_MIN = "2";

const from = (address: string) => ({ "x-forwarded-for": `${address}, 10.0.0.1` });

async function create(address: string): Promise<Response> {
  return workspace.POST(jsonRequest("/api/v1/workspace", { method: "POST", headers: from(address) }));
}

describe("a sandbox for a client without a browser", () => {
  it("answers 201 with the sandbox's agent keys and MCP address, and no cookie", async () => {
    const response = await create("198.51.100.1");
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toEqual([]);
    const info = (await response.json()) as WorkspaceInfo;
    expect(info).toMatchObject({ kind: "sandbox", label: expect.stringMatching(/^Sandbox /), expiresAt: expect.any(String), mcpUrl: "http://localhost:3299/mcp" });
    expect(info.agentKeys.map((key) => key.buyer.name)).toEqual(["Nordic Harbour Hotels", "Kaisla School Kitchens", "Ravintola Laine"]);
    expect(info.agentKeys[0].mcpUrl).toBe(`http://localhost:3299/mcp?key=${info.agentKeys[0].key}`);
    expect(JSON.stringify(info)).not.toContain(WORKSPACE_COOKIE);
  });

  it("gives keys that read that sandbox and nothing else", async () => {
    const info = (await (await create("198.51.100.2")).json()) as WorkspaceInfo;
    const key = info.agentKeys[1].key;
    const response = await orders.GET(jsonRequest("/api/v1/orders", { headers: { authorization: `Bearer ${key}` } }));
    expect(response.status).toBe(200);
    const { orders: list } = (await response.json()) as { orders: { buyer: { name: string } }[] };
    expect(list.every((order) => order.buyer.name === "Kaisla School Kitchens")).toBe(true);
  });

  it("refuses an agent credential", async () => {
    const response = await workspace.POST(jsonRequest("/api/v1/workspace", { method: "POST", headers: { authorization: `Bearer ${AGENT_TOKEN}` } }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "agent_not_allowed" });
  });

  it("limits how many sandboxes one address makes, with a plain sentence and Retry-After", async () => {
    await create("198.51.100.9");
    await create("198.51.100.9");
    const refused = await create("198.51.100.9");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ status: 429, code: "too_many_sandboxes", detail: expect.stringMatching(/sandbox/i) });
    expect((await create("198.51.100.10")).status).toBe(201);
  });
});
