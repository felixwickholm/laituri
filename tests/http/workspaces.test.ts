import { AGENT_TOKEN, jsonRequest, params } from "./env";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import * as activity from "@/app/api/v1/activity/route";
import * as audit from "@/app/api/v1/audit/route";
import * as verify from "@/app/api/v1/audit/verify/route";
import * as reset from "@/app/api/v1/demo/reset/route";
import * as run from "@/app/api/v1/demo/runs/[runId]/route";
import * as runs from "@/app/api/v1/demo/runs/route";
import * as tamper from "@/app/api/v1/demo/tamper/route";
import * as health from "@/app/api/v1/health/route";
import * as mandate from "@/app/api/v1/mandate/route";
import * as orders from "@/app/api/v1/orders/route";
import * as quotes from "@/app/api/v1/quotes/route";
import * as search from "@/app/api/v1/products/search/route";
import * as workspace from "@/app/api/v1/workspace/route";
import * as view from "@/app/api/v1/workspace/view/route";
import { POST as mcp } from "@/app/mcp/route";
import type { AuditEntry, AuditVerification, Order, QuoteResponse } from "@/lib/contracts";
import { DemoRun } from "@/lib/demo";
import type { WorkspaceInfo } from "@/lib/contracts";
import { MILK } from "@/lib/openapi/examples";
import { Health } from "@/lib/openapi/schemas";
import { dataDir, store } from "@/lib/store";
import { sandboxTemplate } from "@/lib/workspace";
import { proxy } from "@/proxy";
import { Browser } from "./browser";

// Every sandbox copies a seeded week; scenes run without pauses.
process.env.LAITURI_SEED = "on";
process.env.LAITURI_DEMO_STEP_MS = "0";

const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));
const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

async function read<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function info(browser: Browser): Promise<WorkspaceInfo> {
  return read(await browser.call(workspace.GET, "/api/v1/workspace"));
}

async function harbourKey(browser: Browser): Promise<string> {
  return (await info(browser)).agentKeys[0].key;
}

async function chain(browser: Browser): Promise<{ entries: AuditEntry[]; verification: AuditVerification }> {
  const { entries } = await read<{ entries: AuditEntry[] }>(await browser.call(audit.GET, "/api/v1/audit"));
  return { entries, verification: await read(await browser.call(verify.GET, "/api/v1/audit/verify")) };
}

/** A quote and an order with a sandbox agent key, as Claude or ChatGPT would place them. */
async function buyWithKey(key: string, litres: number, idempotencyKey: string): Promise<Order> {
  const request = { lines: [{ productId: MILK.productId, quantity: { amount: litres, unit: "l" } }], deliverBy: MILK.deliverBy };
  const quote = await read<QuoteResponse>(await quotes.POST(jsonRequest("/api/v1/quotes", { body: request, headers: bearer(key) })));
  const { jws } = await read<{ jws: string }>(await mandate.GET(jsonRequest("/api/v1/mandate", { headers: bearer(key) })));
  const placed = await orders.POST(jsonRequest("/api/v1/orders", { body: { offerJws: quote.primary.jws, mandateJws: jws, idempotencyKey }, headers: bearer(key) }));
  return read(placed);
}

beforeAll(async () => {
  await sandboxTemplate();
}, 120_000);

describe("a visitor's sandbox", () => {
  it("starts as a verifiable copy of the seeded week, with its own label and agent keys", async () => {
    const [one, two] = [new Browser(), new Browser()];
    const [a, b] = [await info(one), await info(two)];
    expect(a).toMatchObject({ kind: "sandbox", mcpUrl: "http://localhost:3299/mcp", expiresAt: expect.any(String) });
    expect(a.label).not.toBe(b.label);
    expect(a.agentKeys.map((key) => key.buyer.name)).toEqual(["Nordic Harbour Hotels", "Kaisla School Kitchens", "Ravintola Laine"]);
    expect(a.agentKeys[0]).toMatchObject({ agent: { name: "Harbour purchasing agent" }, mcpUrl: `http://localhost:3299/mcp?key=${a.agentKeys[0].key}` });
    expect(a.agentKeys.map((key) => key.key)).not.toEqual(b.agentKeys.map((key) => key.key));
    expect(JSON.stringify(a)).not.toContain(one.cookie().split("=")[1].slice(0, 12));
    const [first, second] = [await chain(one), await chain(two)];
    expect(first.verification.valid).toBe(true);
    expect(first.entries.length).toBeGreaterThan(20);
    expect(first.entries.map((entry) => entry.hash)).toEqual(second.entries.map((entry) => entry.hash));
  });

  it("describes the shared workspace, with the fixed demo tokens, to a caller without a cookie", async () => {
    const shared = await info(new Browser({ sandbox: false }));
    expect(shared).toMatchObject({ kind: "shared" });
    expect(shared).not.toHaveProperty("expiresAt");
    expect(shared.agentKeys.map((key) => key.key)).toEqual(["demo-agent-token", "demo-kaisla-token", "demo-laine-token"]);
  });

  it("is never described to an agent credential", async () => {
    const browser = new Browser();
    const key = await harbourKey(browser);
    for (const credential of [key, AGENT_TOKEN]) {
      const refused = await browser.call(workspace.GET, "/api/v1/workspace", { headers: bearer(credential) });
      expect(refused.status).toBe(403);
      expect((await read<{ code: string }>(refused)).code).toBe("agent_not_allowed");
    }
  });

  it.skipIf(!hasFixtures)("keeps orders, the audit chain and activity apart from every other sandbox", async () => {
    const [one, two] = [new Browser(), new Browser()];
    const order = await buyWithKey(await harbourKey(one), 1000, "ws-apart-1");
    expect(order.status).toBe("confirmed");
    const listed = (browser: Browser) => browser.call(orders.GET, "/api/v1/orders").then((response) => read<{ orders: Order[] }>(response));
    expect((await listed(one)).orders.map((item) => item.id)).toContain(order.id);
    expect((await listed(two)).orders.map((item) => item.id)).not.toContain(order.id);
    const [first, second] = [await chain(one), await chain(two)];
    expect(first.entries.length).toBeGreaterThan(second.entries.length);
    expect(first.entries.some((entry) => entry.refs.orderId === order.id)).toBe(true);
    expect(second.entries.some((entry) => entry.refs.orderId === order.id)).toBe(false);
    const feed = (browser: Browser) => browser.call(activity.GET, "/api/v1/activity").then((response) => read<{ activity: { refs?: { orderId?: string } }[] }>(response));
    expect((await feed(one)).activity.some((item) => item.refs?.orderId === order.id)).toBe(true);
    expect((await feed(two)).activity.some((item) => item.refs?.orderId === order.id)).toBe(false);
    expect((await store().orders.list()).some((item) => item.id === order.id)).toBe(false);
  });

  it("lets a tamper and a reset touch only the sandbox that asked", async () => {
    const [one, two] = [new Browser(), new Browser()];
    const before = await chain(two);
    expect((await one.call(tamper.POST, "/api/v1/demo/tamper", { method: "POST" })).status).toBe(200);
    expect((await chain(one)).verification.valid).toBe(false);
    expect(await chain(two)).toEqual(before);
    expect((await chain(new Browser({ sandbox: false }))).verification.valid).toBe(true);

    const restored = await one.call(reset.POST, "/api/v1/demo/reset", { method: "POST" });
    expect(restored.status).toBe(200);
    expect((await chain(one)).verification.valid).toBe(true);
    expect((await chain(one)).entries.map((entry) => entry.hash)).toEqual(before.entries.map((entry) => entry.hash));
    expect(await chain(two)).toEqual(before);
  });

  it("refuses a sandbox's reset and tamper to its own agent keys", async () => {
    const browser = new Browser();
    const key = await harbourKey(browser);
    for (const [handler, url] of [[reset.POST, "/api/v1/demo/reset"], [tamper.POST, "/api/v1/demo/tamper"]] as const) {
      const refused = await browser.call(handler, url, { method: "POST", headers: bearer(key) });
      expect(refused.status).toBe(403);
    }
  });

  it("serves a sandbox key over REST and MCP in its own sandbox, whatever cookie comes with it", async () => {
    const [owner, stranger] = [new Browser(), new Browser()];
    const key = await harbourKey(owner);
    const searched = await stranger.call(search.POST, "/api/v1/products/search", { body: { query: "unobtainium" }, headers: bearer(key) });
    expect(searched.status).toBe(200);
    const tools = await mcp(
      jsonRequest(`/mcp?key=${key}`, {
        body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_catalog", arguments: { query: "kaurajuoma" } } },
        headers: { "mcp-protocol-version": "2025-06-18" },
      }),
    );
    expect(tools.status).toBe(200);
    const titles = async (browser: Browser) =>
      (await read<{ activity: { title: string }[] }>(await browser.call(activity.GET, "/api/v1/activity"))).activity.map((item) => item.title);
    expect(await titles(owner)).toEqual(expect.arrayContaining(["Searched the catalogue for 'unobtainium'", "Searched the catalogue for 'kaurajuoma'"]));
    expect(await titles(stranger)).not.toContain("Searched the catalogue for 'unobtainium'");
    expect((await store().activity.list()).some((item) => item.title.includes("unobtainium"))).toBe(false);
  });

  it("refuses an unknown or expired key instead of falling back to the shared workspace's buyers", async () => {
    const response = await search.POST(jsonRequest("/api/v1/products/search", { body: { query: "maito" }, headers: bearer("lsk_not-a-real-key") }));
    expect(response.status).toBe(401);
  });

  it.skipIf(!hasFixtures)("keeps a background scene in the sandbox that started it", async () => {
    const [one, two] = [new Browser(), new Browser()];
    const sharedBefore = (await store().activity.list()).length;
    const twoBefore = (await chain(two)).entries.length;
    const started = await one.call(runs.POST, "/api/v1/demo/runs", { body: { scenario: "milk" } });
    expect(started.status).toBe(202);
    const { runId } = await read<{ runId: string }>(started);
    let state: DemoRun | undefined;
    for (let attempt = 0; attempt < 200 && state?.status !== "done" && state?.status !== "failed"; attempt += 1) {
      state = await read<DemoRun>(await one.call(run.GET, `/api/v1/demo/runs/${runId}`, { params: { runId } }));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(state?.status).toBe("done");
    expect((await two.call(run.GET, `/api/v1/demo/runs/${runId}`, { params: { runId } })).status).toBe(404);
    expect((await chain(two)).entries).toHaveLength(twoBefore);
    expect(await store().activity.list()).toHaveLength(sharedBefore);
    expect((await chain(one)).entries.length).toBeGreaterThan(twoBefore);
  });

  it("is never written to disk; the shared workspace still is", async () => {
    const browser = new Browser();
    await browser.call(search.POST, "/api/v1/products/search", { body: { query: "sandbox-only-words" }, headers: bearer(await harbourKey(browser)) });
    await search.POST(jsonRequest("/api/v1/products/search", { body: { query: "shared-words" }, headers: bearer(AGENT_TOKEN) }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    const saved = readFileSync(path.join(dataDir(), "state.json"), "utf8");
    expect(saved).toContain("shared-words");
    expect(saved).not.toContain("sandbox-only-words");
  });
});

describe("the first page load", () => {
  it("gets a sandbox secret from the proxy, so the page's concurrent first calls share one sandbox", async () => {
    const response = proxy(new NextRequest("http://localhost:3299/buyer"));
    const setCookie = response.cookies.get("laituri_workspace");
    expect(setCookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    const cookie = `laituri_workspace=${setCookie!.value}`;
    const calls = Array.from({ length: 4 }, () => workspace.GET(jsonRequest("/api/v1/workspace", { headers: { cookie } }), params({})));
    const labels = new Set(await Promise.all(calls.map(async (call) => (await read<WorkspaceInfo>(await call)).label)));
    expect(labels.size).toBe(1);
  });

  it("keeps a secret the browser already holds, and gives none to API calls", () => {
    const held = new Browser().cookie();
    expect(proxy(new NextRequest("http://localhost:3299/valio", { headers: { cookie: held } })).cookies.get("laituri_workspace")).toBeUndefined();
  });
});

describe("looking at the shared workspace", () => {
  it("shows the shared workspace read-only, and keeps the sandbox for the way back", async () => {
    const browser = new Browser();
    const own = await info(browser);
    const shared = await read<WorkspaceInfo>(await browser.call(view.POST, "/api/v1/workspace/view", { body: { view: "shared" } }));
    expect(shared.kind).toBe("shared");
    expect((await info(browser)).kind).toBe("shared");
    const write = await browser.call(runs.POST, "/api/v1/demo/runs", { body: { scenario: "milk" } });
    expect(write.status).toBe(403);
    expect((await read<{ code: string }>(write)).code).toBe("shared_read_only");
    const back = await read<WorkspaceInfo>(await browser.call(view.POST, "/api/v1/workspace/view", { body: { view: "sandbox" } }));
    expect(back.label).toBe(own.label);
    expect((await info(browser)).label).toBe(own.label);
  });
});

describe("health", () => {
  it("counts the active sandboxes and says what they are copied from", async () => {
    const before = Health.parse(await read(await new Browser({ sandbox: false }).call(health.GET, "/api/v1/health"))).sandboxes;
    await info(new Browser());
    const after = Health.parse(await read(await new Browser({ sandbox: false }).call(health.GET, "/api/v1/health"))).sandboxes;
    expect(after.active).toBe(before.active + 1);
    expect(after).toMatchObject({ max: 300, idleMinutes: 60, template: { state: "seeded" } });
  });
});
