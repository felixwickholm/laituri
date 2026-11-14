import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Live mode against a stand-in for the wholesaler API, whose answers each test sets; status 0 drops the connection. */
const API_KEY = "upstream-secret-key-7f3a";
process.env.VALIO_API_KEY = API_KEY;
delete process.env.VALIO_MODE;
process.env.LAITURI_NOW = "2026-11-14T09:00:00+02:00";
process.env.LAITURI_DATA_DIR = mkdtempSync(path.join(tmpdir(), "laituri-upstream-"));
process.env.LAITURI_CATALOG = path.join(process.cwd(), "fixtures", "upstream", "catalog.json");

const upstream = { status: 500 };
let server: Server;
let baseUrl = "";

const BEARER = { authorization: "Bearer demo-agent-token", "content-type": "application/json" };
const MILK = "464306";

beforeAll(async () => {
  server = createServer((_, response) => {
    if (upstream.status === 0) {
      response.socket?.destroy();
      return;
    }
    response.statusCode = upstream.status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "upstream says no", path: "/api/price" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  process.env.VALIO_API_URL = baseUrl;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const routes = {
  quotes: () => import("@/app/api/v1/quotes/route"),
  orders: () => import("@/app/api/v1/orders/route"),
  order: () => import("@/app/api/v1/orders/[id]/route"),
  product: () => import("@/app/api/v1/products/[id]/route"),
  health: () => import("@/app/api/v1/health/route"),
  mcp: () => import("@/app/mcp/route"),
};

function request(pathname: string, init: { method?: string; body?: string } = {}): Request {
  return new Request(`http://localhost:3299${pathname}`, { method: init.method ?? (init.body ? "POST" : "GET"), headers: BEARER, body: init.body });
}

const quote = (deliverBy: string) =>
  JSON.stringify({ lines: [{ productId: MILK, quantity: { amount: 10, unit: "l" } }], deliverBy, intent: "10 litres of milk" });

/** Every way a body could leak where the wholesaler API lives or the key that opens it. */
function leaks(text: string): string[] {
  const host = new URL(baseUrl).host;
  return [baseUrl, host, "/api/price", "/api/availability", "/api/ping", "/price", "/availability", API_KEY, "answered 500", "answered 404"].filter((needle) => text.includes(needle));
}

async function bodies(): Promise<[string, string][]> {
  const { POST: quotes } = await routes.quotes();
  const { POST: orders } = await routes.orders();
  const { GET: order } = await routes.order();
  const { GET: product } = await routes.product();
  const { GET: health } = await routes.health();
  const { POST: mcp } = await routes.mcp();
  const params = (value: Record<string, string>) => ({ params: Promise.resolve(value) });
  const calls: [string, () => Promise<Response>][] = [
    ["quote", () => quotes(request("/api/v1/quotes", { body: quote("2026-11-16") }))],
    ["quote, invalid calendar date", () => quotes(request("/api/v1/quotes", { body: quote("2027-02-31") }))],
    ["quote, bad JSON", () => quotes(request("/api/v1/quotes", { body: "{not json" }))],
    ["order, unknown offer", () => orders(request("/api/v1/orders", { body: JSON.stringify({ offerJws: "a.b.c", mandateJws: "a.b.c", idempotencyKey: "leak-check-1" }) }))],
    ["unknown order", () => order(request("/api/v1/orders/ord_missing"), params({ id: "ord_missing" }))],
    ["unknown product", () => product(request("/api/v1/products/000000"), params({ id: "000000" }))],
    ["health", () => health(request("/api/v1/health"))],
    ["MCP quote", () => mcp(request("/mcp", { body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "request_quote", arguments: JSON.parse(quote("2026-11-17")) } }) }))],
  ];
  const answers: [string, string][] = [];
  for (const [name, call] of calls) answers.push([name, await (await call()).text()]);
  return answers;
}

describe("no answer names the wholesaler API or its key", () => {
  it.each([
    ["the API answers 500", 500],
    ["the API answers 404", 404],
    ["the API answers 401", 401],
  ])("when %s", async (_, status) => {
    upstream.status = status;
    for (const [name, text] of await bodies()) expect(leaks(text), `${name}: ${text.slice(0, 300)}`).toEqual([]);
  }, 30_000);

  it("when the API drops the connection", async () => {
    upstream.status = 0;
    for (const [name, text] of await bodies()) expect(leaks(text), `${name}: ${text.slice(0, 300)}`).toEqual([]);
  }, 30_000);

  it("says plainly that the price or stock service did not answer", async () => {
    upstream.status = 500;
    const { POST: quotes } = await routes.quotes();
    const response = await quotes(request("/api/v1/quotes", { body: quote("2026-11-19") }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "upstream_unavailable", detail: "The wholesaler's price or stock service did not answer. Try again in a minute." });
  }, 30_000);
});
