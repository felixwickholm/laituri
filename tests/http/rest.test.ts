import { AGENT_TOKEN, jsonRequest, params } from "./env";
import { describe, expect, it } from "vitest";
import * as approval from "@/app/api/v1/approvals/[orderId]/route";
import * as audit from "@/app/api/v1/audit/route";
import * as session from "@/app/api/v1/console/session/route";
import * as verify from "@/app/api/v1/audit/verify/route";
import * as reset from "@/app/api/v1/demo/reset/route";
import * as mandate from "@/app/api/v1/mandate/route";
import * as order from "@/app/api/v1/orders/[id]/route";
import * as orders from "@/app/api/v1/orders/route";
import * as search from "@/app/api/v1/products/search/route";
import * as quotes from "@/app/api/v1/quotes/route";
import { TOKEN_TYPE, trust } from "@/lib/trust";

const PROBLEM = "application/problem+json";

describe("REST problems", () => {
  it("rejects an invalid quote with violations", async () => {
    const response = await quotes.POST(jsonRequest("/api/v1/quotes", { body: { lines: [], deliverBy: "Monday" } }));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe(PROBLEM);
    const body = await response.json();
    expect(body).toMatchObject({ status: 400, code: "invalid_request" });
    const paths = body.violations.map((v: { path: string }) => v.path);
    expect(paths).toEqual(expect.arrayContaining(["lines", "deliverBy"]));
  });

  it("rejects a body that is not JSON", async () => {
    const response = await search.POST(jsonRequest("/api/v1/products/search", { body: "{nope" }));
    expect(response.status).toBe(400);
    expect((await response.json()).detail).toMatch(/not valid JSON/);
  });

  it("returns 404 for an unknown order", async () => {
    const response = await order.GET(jsonRequest("/api/v1/orders/ord-missing"), params({ id: "ord-missing" }));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(PROBLEM);
    expect((await response.json()).code).toBe("not_found");
  });

  it("returns 401 for an unknown bearer token", async () => {
    const request = jsonRequest("/api/v1/orders/x", { headers: { authorization: "Bearer wrong" } });
    const response = await order.GET(request, params({ id: "x" }));
    expect(response.status).toBe(401);
  });

  it("rejects a non-numeric audit cursor", async () => {
    const response = await audit.GET(jsonRequest("/api/v1/audit?after=abc"));
    expect(response.status).toBe(400);
  });
});

describe("human-only endpoints", () => {
  const agentHeaders = { authorization: `Bearer ${AGENT_TOKEN}` };
  const decide = (headers: Record<string, string>, orderId = "ord-missing") =>
    approval.POST(jsonRequest(`/api/v1/approvals/${orderId}`, { body: { decision: "approved" }, headers }), params({ orderId }));

  async function approverCookie(passcode?: string): Promise<string> {
    const response = await session.POST(jsonRequest("/api/v1/console/session", { body: { passcode } }));
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie")!.split(";")[0];
  }

  it("refuses an agent token on approvals", async () => {
    const response = await decide(agentHeaders, "x");
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Agents cannot approve or reject orders.");
    const log = await (await audit.GET(jsonRequest("/api/v1/audit"))).json();
    const entries = log.entries ?? log;
    expect(entries.at(-1)).toMatchObject({ event: "access.refused", refs: { orderId: "x" } });
  });

  it("refuses an agent token on mandate update, reset and sign-in", async () => {
    const put = await mandate.PUT(jsonRequest("/api/v1/mandate", { method: "PUT", body: {}, headers: agentHeaders }));
    const post = await reset.POST(jsonRequest("/api/v1/demo/reset", { method: "POST", headers: agentHeaders }));
    const signIn = await session.POST(jsonRequest("/api/v1/console/session", { body: {}, headers: agentHeaders }));
    expect([put.status, post.status, signIn.status]).toEqual([403, 403, 403]);
  });

  it("refuses a forged console header, a made-up cookie and a public approval signature", async () => {
    const publicApproval = await trust().sign("approver", { orderId: "x", decision: "approved" }, TOKEN_TYPE.approval);
    const attempts: Record<string, string>[] = [
      {},
      { "x-laituri-console": "1" },
      { "x-laituri-console": "1", cookie: "laituri_approver=1; session=admin" },
      { cookie: `laituri_approver=${publicApproval}` },
    ];
    for (const headers of attempts) {
      const response = await decide(headers);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("approver_sign_in_required");
    }
  });

  it("asks for the passcode when one is configured", async () => {
    process.env.LAITURI_APPROVER_PASSCODE = "open-sesame";
    try {
      const wrong = await session.POST(jsonRequest("/api/v1/console/session", { body: { passcode: "guess" } }));
      const missing = await session.POST(jsonRequest("/api/v1/console/session", { body: {} }));
      expect([wrong.status, missing.status]).toEqual([403, 403]);
      const cookie = await approverCookie("open-sesame");
      expect((await decide({ cookie })).status).toBe(404);
    } finally {
      delete process.env.LAITURI_APPROVER_PASSCODE;
    }
  });

  it("lets a signed-in approver change one limit and keeps the rest", async () => {
    const cookie = await approverCookie();
    const body = { limits: { perOrder: { amount: 2000, currency: "EUR" } } };
    const response = await mandate.PUT(jsonRequest("/api/v1/mandate", { method: "PUT", body, headers: { cookie } }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.mandate.limits.perOrder.amount).toBe(2000);
    expect(result.mandate.limits.perWeek.amount).toBe(5000);
    expect(typeof result.jws).toBe("string");
  });
});

describe("orders and audit", () => {
  it("takes the idempotency key from the header", async () => {
    const request = jsonRequest("/api/v1/orders", {
      body: { offerJws: "a.b.c", mandateJws: "d.e.f" },
      headers: { "idempotency-key": "header-key-123" },
    });
    const body = await (await orders.POST(request)).json();
    const keyViolation = body.violations?.some((v: { path: string }) => v.path === "idempotencyKey");
    expect(keyViolation ?? false).toBe(false);
  });

  it("lists orders and verifies the audit chain", async () => {
    const list = await orders.GET(jsonRequest("/api/v1/orders"));
    expect(Array.isArray((await list.json()).orders)).toBe(true);
    const verification = await (await verify.GET(jsonRequest("/api/v1/audit/verify"))).json();
    expect(verification.valid).toBe(true);
  });
});
