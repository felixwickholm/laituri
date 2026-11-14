import { AGENT_TOKEN, BASE } from "./env";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { gateway } from "@/lib/gateway";
import { TOOLS } from "@/lib/mcp/tools";
import { store } from "@/lib/store";

const hasCatalog = [".data/catalog.json", "fixtures/upstream/catalog.json"].some((file) => existsSync(path.resolve(file)));

const APP_DIR = path.resolve("src/app");
const HARBOUR_AGENT = "agent:harbour-purchasing";
const SUSPENDED = { authorization: `Bearer ${AGENT_TOKEN}` };
const OPERATOR = { id: "operator:valio-aimo", name: "Valio Aimo operator" };
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

type Method = (typeof METHODS)[number];
type Handler = (request: Request, context?: { params: Promise<Record<string, string>> }) => Response | Promise<Response>;

/**
 * Every route the app serves, by folder under src/app, with a URL that reaches it and the params Next.js would pass.
 * A new route fails the coverage test below until it is listed here.
 */
const ROUTES: Record<string, { url: string; params?: Record<string, string> }> = {
  "api/v1/activity": { url: "/api/v1/activity" },
  "api/v1/approvals": { url: "/api/v1/approvals" },
  "api/v1/approvals/[orderId]": { url: "/api/v1/approvals/ord_x", params: { orderId: "ord_x" } },
  "api/v1/audit": { url: "/api/v1/audit" },
  "api/v1/audit/checkpoint": { url: "/api/v1/audit/checkpoint" },
  "api/v1/audit/verify": { url: "/api/v1/audit/verify" },
  "api/v1/console/session": { url: "/api/v1/console/session" },
  "api/v1/demo/reset": { url: "/api/v1/demo/reset" },
  "api/v1/demo/runs": { url: "/api/v1/demo/runs" },
  "api/v1/demo/runs/[runId]": { url: "/api/v1/demo/runs/run_x", params: { runId: "run_x" } },
  "api/v1/demo/tamper": { url: "/api/v1/demo/tamper" },
  "api/v1/health": { url: "/api/v1/health" },
  "api/v1/mandate": { url: "/api/v1/mandate" },
  "api/v1/offers/[id]": { url: "/api/v1/offers/off_x", params: { id: "off_x" } },
  "api/v1/openapi.json": { url: "/api/v1/openapi.json" },
  "api/v1/orders": { url: "/api/v1/orders" },
  "api/v1/orders/[id]": { url: "/api/v1/orders/ord_x", params: { id: "ord_x" } },
  "api/v1/products/[id]": { url: "/api/v1/products/p_x", params: { id: "p_x" } },
  "api/v1/products/search": { url: "/api/v1/products/search" },
  "api/v1/quotes": { url: "/api/v1/quotes" },
  "api/v1/supplier/agents/[agentId]/suspension": {
    url: `/api/v1/supplier/agents/${encodeURIComponent(HARBOUR_AGENT)}/suspension`,
    params: { agentId: HARBOUR_AGENT },
  },
  "api/v1/supplier/overview": { url: "/api/v1/supplier/overview" },
  "api/v1/voice": { url: "/api/v1/voice" },
  "api/v1/voice/speech": { url: "/api/v1/voice/speech" },
  "api/v1/workspace": { url: "/api/v1/workspace" },
  "api/v1/workspace/view": { url: "/api/v1/workspace/view" },
  ".well-known/agent-card.json": { url: "/.well-known/agent-card.json" },
  ".well-known/ai-catalog.json": { url: "/.well-known/ai-catalog.json" },
  ".well-known/jwks.json": { url: "/.well-known/jwks.json" },
  ".well-known/oauth-protected-resource": { url: "/.well-known/oauth-protected-resource" },
  ".well-known/ucp": { url: "/.well-known/ucp" },
  "evidence.json": { url: "/evidence.json" },
  "llms.txt": { url: "/llms.txt" },
  mcp: { url: "/mcp" },
};

/** Handlers that serve nothing to anyone, so there is nothing to refuse: the stateless MCP endpoint answers only POST. */
const SERVES_NOTHING: Partial<Record<string, Method[]>> = { mcp: ["GET", "DELETE", "OPTIONS"] };

/** Documents anyone may read without a credential, as before suspension existed. */
const PUBLIC_DOCUMENTS = [
  "api/v1/openapi.json",
  "api/v1/health",
  "api/v1/audit/verify",
  "api/v1/audit/checkpoint",
  ".well-known/agent-card.json",
  ".well-known/ai-catalog.json",
  ".well-known/jwks.json",
  ".well-known/oauth-protected-resource",
  ".well-known/ucp",
  "evidence.json",
  "llms.txt",
];

/** Records only an agent key, the browser's own sandbox or a signed-in person may read. */
const RECORD_READS = [
  "api/v1/orders",
  "api/v1/orders/[id]",
  "api/v1/offers/[id]",
  "api/v1/mandate",
  "api/v1/approvals",
  "api/v1/activity",
  "api/v1/audit",
  "api/v1/supplier/overview",
];

function routeFolders(dir = APP_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFolders(full);
    return entry.name === "route.ts" ? [path.relative(APP_DIR, dir).split(path.sep).join("/")] : [];
  });
}

async function handlers(folder: string): Promise<[Method, Handler][]> {
  const routeModule = (await import(path.join(APP_DIR, folder, "route.ts"))) as Partial<Record<Method, Handler>>;
  return METHODS.flatMap((method) => (routeModule[method] ? [[method, routeModule[method]] as [Method, Handler]] : []));
}

function send(folder: string, method: Method, handler: Handler, headers: Record<string, string> = {}): Promise<Response> {
  const { url, params = {} } = ROUTES[folder];
  const hasBody = method === "POST" || method === "PUT";
  const request = new Request(BASE + url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(hasBody ? { body: "{}" } : {}),
  });
  return Promise.resolve(handler(request, { params: Promise.resolve(params) }));
}

function mcp(method: string, params: unknown, headers: Record<string, string>, query = ""): Request {
  return new Request(`${BASE}/mcp${query}`, {
    method: "POST",
    headers: { "content-type": "application/json", "mcp-protocol-version": "2025-06-18", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

async function refusals(): Promise<number> {
  return (await store().audit.list()).filter((entry) => entry.event === "access.refused" && entry.data.code === "agent_suspended").length;
}

beforeEach(async () => {
  await gateway().reset();
});

describe("the route list", () => {
  it("names every route the app serves", () => {
    expect(routeFolders().sort()).toEqual(Object.keys(ROUTES).sort());
  });
});

describe.skipIf(!hasCatalog)("a suspended agent's credential", () => {
  beforeEach(async () => {
    const search = await import("@/app/api/v1/products/search/route");
    const body = JSON.stringify({ query: "maito" });
    const reached = await search.POST(new Request(`${BASE}/api/v1/products/search`, { method: "POST", headers: SUSPENDED, body }));
    expect(reached.status).toBe(200);
    await gateway().setAgentSuspension(HARBOUR_AGENT, { suspended: true }, OPERATOR);
  });

  it("is refused with 403 agent_suspended by every handler that serves anything, each refusal logged", async () => {
    let refused = 0;
    for (const folder of Object.keys(ROUTES)) {
      for (const [method, handler] of await handlers(folder)) {
        if (SERVES_NOTHING[folder]?.includes(method)) continue;
        const response = await send(folder, method, handler, SUSPENDED);
        expect.soft(response.status, `${method} /${folder}`).toBe(403);
        expect.soft((await response.json()).code, `${method} /${folder}`).toBe("agent_suspended");
        refused += 1;
      }
    }
    expect(refused).toBeGreaterThan(Object.keys(ROUTES).length);
    expect(await refusals()).toBe(refused);
    expect((await gateway().verifyAudit()).valid).toBe(true);
  });

  it("is refused for every MCP method, with the key in a header or in the address", async () => {
    const { POST } = await import("@/app/mcp/route");
    const calls: [string, unknown][] = [
      ["initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } }],
      ["ping", {}],
      ["tools/list", {}],
      ...TOOLS.map((tool): [string, unknown] => ["tools/call", { name: tool.name, arguments: {} }]),
    ];
    for (const [method, params] of calls) {
      for (const request of [mcp(method, params, SUSPENDED), mcp(method, params, {}, `?key=${AGENT_TOKEN}`)]) {
        const response = await POST(request);
        expect.soft(response.status, method).toBe(403);
        expect.soft((await response.json()).code, method).toBe("agent_suspended");
      }
    }
    expect(await refusals()).toBe(calls.length * 2);
  });

  it("leaves the public documents readable without a credential", async () => {
    for (const folder of PUBLIC_DOCUMENTS) {
      const [[method, handler]] = await handlers(folder);
      expect.soft((await send(folder, method, handler)).status, `${method} /${folder}`).toBe(200);
    }
    expect(await refusals()).toBe(0);
  });

  it("gets no records back by dropping its token: every record read answers 401", async () => {
    for (const folder of RECORD_READS) {
      const [[method, handler]] = await handlers(folder);
      const response = await send(folder, method, handler);
      expect.soft(response.status, `${method} /${folder}`).toBe(401);
      expect.soft((await response.json()).code, `${method} /${folder}`).toBe("credential_required");
    }
  });
});
