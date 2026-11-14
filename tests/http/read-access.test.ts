import { AGENT_TOKEN, jsonRequest, params } from "./env";
import { describe, expect, it } from "vitest";
import * as activity from "@/app/api/v1/activity/route";
import * as approvals from "@/app/api/v1/approvals/route";
import * as audit from "@/app/api/v1/audit/route";
import * as checkpoint from "@/app/api/v1/audit/checkpoint/route";
import * as verify from "@/app/api/v1/audit/verify/route";
import * as health from "@/app/api/v1/health/route";
import * as mandate from "@/app/api/v1/mandate/route";
import * as offer from "@/app/api/v1/offers/[id]/route";
import * as openapi from "@/app/api/v1/openapi.json/route";
import * as order from "@/app/api/v1/orders/[id]/route";
import * as orders from "@/app/api/v1/orders/route";
import * as overview from "@/app/api/v1/supplier/overview/route";
import * as llms from "@/app/llms.txt/route";
import * as jwksRoute from "@/app/.well-known/jwks.json/route";
import * as agentCard from "@/app/.well-known/agent-card.json/route";
import * as evidence from "@/app/evidence.json/route";
import { POST as mcp } from "@/app/mcp/route";
import { appendAudit, isStub, verifyChain } from "@/lib/audit";
import type { AuditRecord } from "@/lib/contracts";
import { BUYER_IDS } from "@/lib/mandate";
import { jwks, TOKEN_TYPE, verifyWithJwks } from "@/lib/trust";
import { Browser } from "./browser";

const HOTEL_AGENT = { type: "agent" as const, id: "agent:harbour-purchasing", name: "Harbour purchasing agent" };
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

type Handler = (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>;

const PROTECTED: [string, Handler, Record<string, string>?][] = [
  ["/api/v1/orders", orders.GET],
  ["/api/v1/orders/ord_any", order.GET, { id: "ord_any" }],
  ["/api/v1/offers/off_any", offer.GET, { id: "off_any" }],
  ["/api/v1/mandate", mandate.GET],
  ["/api/v1/approvals", approvals.GET],
  ["/api/v1/activity", activity.GET],
  ["/api/v1/supplier/overview", overview.GET],
  ["/api/v1/audit", audit.GET],
];

const PUBLIC: [string, Handler][] = [
  ["/api/v1/openapi.json", openapi.GET],
  ["/.well-known/jwks.json", jwksRoute.GET],
  ["/.well-known/agent-card.json", agentCard.GET],
  ["/llms.txt", llms.GET],
  ["/api/v1/health", health.GET],
  ["/evidence.json", evidence.GET],
  ["/api/v1/audit/checkpoint", checkpoint.GET],
  ["/api/v1/audit/verify", verify.GET],
];

async function records(response: Response): Promise<AuditRecord[]> {
  return ((await response.json()) as { entries: AuditRecord[] }).entries;
}

async function mcpTool(name: string, args: Record<string, unknown>): Promise<{ isError?: boolean; content: { text: string }[] }> {
  const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } };
  const response = await mcp(jsonRequest("/mcp", { body }));
  return ((await response.json()) as { result: { isError?: boolean; content: { text: string }[] } }).result;
}

describe("reading records needs a credential", () => {
  it.each(PROTECTED)("answers 401 with a plain sentence on %s without any credential", async (path, handler, values) => {
    const response = await handler(jsonRequest(path), params(values ?? {}));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ status: 401, code: "credential_required", detail: expect.stringMatching(/POST \/api\/v1\/workspace/) });
  });

  it.each(PUBLIC)("keeps %s public", async (path, handler) => {
    expect((await handler(jsonRequest(path), params({}))).status).toBe(200);
  });

  it("treats a browser that only set the shared-view cookie as a caller without a credential", async () => {
    const response = await orders.GET(jsonRequest("/api/v1/orders", { headers: { cookie: "laituri_view=shared" } }));
    expect(response.status).toBe(401);
  });

  it("refuses the MCP order and mandate reads without a key", async () => {
    for (const [name, args] of [["get_order", { orderId: "ord_any" }], ["get_mandate", {}]] as const) {
      const result = await mcpTool(name, args);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/agent key/);
    }
  });

  it("lets an agent token read its own buyer's records", async () => {
    expect((await orders.GET(jsonRequest("/api/v1/orders", { headers: bearer(AGENT_TOKEN) }))).status).toBe(200);
    expect((await mandate.GET(jsonRequest("/api/v1/mandate", { headers: bearer(AGENT_TOKEN) }))).status).toBe(200);
  });

  it("lets a browser in its own sandbox read everything there", async () => {
    const browser = new Browser();
    expect((await browser.call(orders.GET, "/api/v1/orders")).status).toBe(200);
    expect((await browser.call(overview.GET, "/api/v1/supplier/overview")).status).toBe(200);
    const entries = await records(await browser.call(audit.GET, "/api/v1/audit"));
    expect(entries.some(isStub)).toBe(false);
  });
});

describe("an agent token reads the audit log", () => {
  it("gets its own buyer's entries in full and every other entry as a stub, and the chain still verifies", async () => {
    await appendAudit({ actor: HOTEL_AGENT, event: "offer.issued", summary: "Hotel offer.", refs: { buyerId: BUYER_IDS.nordicHarbour } });
    await appendAudit({ actor: HOTEL_AGENT, event: "offer.issued", summary: "School offer, 800 EUR.", refs: { buyerId: BUYER_IDS.kaisla } });
    await appendAudit({ actor: HOTEL_AGENT, event: "catalog.searched", summary: "Anonymous search." });
    const entries = await records(await audit.GET(jsonRequest("/api/v1/audit", { headers: bearer(AGENT_TOKEN) })));
    const full = entries.filter((entry) => !isStub(entry));
    expect(full.length).toBeGreaterThan(0);
    expect(full.every((entry) => "refs" in entry && entry.refs.buyerId === BUYER_IDS.nordicHarbour)).toBe(true);
    expect(JSON.stringify(entries)).not.toContain("School offer");
    expect(JSON.stringify(entries)).not.toContain("Anonymous search");
    const keys = await jwks("supplier");
    expect(await verifyChain(entries, (jws) => verifyWithJwks(jws, keys, TOKEN_TYPE.audit))).toMatchObject({ valid: true, entries: entries.length });
  });
});
