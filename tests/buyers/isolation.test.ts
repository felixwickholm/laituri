import { AGENT_TOKEN, jsonRequest, params } from "../http/env";
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as activity from "@/app/api/v1/activity/route";
import * as decide from "@/app/api/v1/approvals/[orderId]/route";
import * as approvals from "@/app/api/v1/approvals/route";
import * as session from "@/app/api/v1/console/session/route";
import * as mandate from "@/app/api/v1/mandate/route";
import * as order from "@/app/api/v1/orders/[id]/route";
import * as orders from "@/app/api/v1/orders/route";
import * as quotes from "@/app/api/v1/quotes/route";
import { POST as mcp } from "@/app/mcp/route";
import type { Order, QuoteResponse } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { BUYER_IDS } from "@/lib/mandate";
import { MILK } from "@/lib/openapi/examples";
import { Browser } from "../http/browser";

const KAISLA_TOKEN = "demo-kaisla-token";
const LAINE_TOKEN = "demo-laine-token";
const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function mandateOf(token: string) {
  return body<{ jws: string; mandate: { buyer: { id: string; name: string }; agent: { id: string; name: string } } }>(
    await mandate.GET(jsonRequest("/api/v1/mandate", { headers: bearer(token) })),
  );
}

async function quote(token: string, litres: number): Promise<QuoteResponse> {
  const request = {
    lines: [{ productId: MILK.productId, quantity: { amount: litres, unit: "l" } }],
    deliverBy: MILK.deliverBy,
    intent: `${litres} litres of lactose-free milk by Monday`,
  };
  return body(await quotes.POST(jsonRequest("/api/v1/quotes", { body: request, headers: bearer(token) })));
}

async function place(token: string, offerJws: string, mandateJws: string, key: string): Promise<Response> {
  return orders.POST(jsonRequest("/api/v1/orders", { body: { offerJws, mandateJws, idempotencyKey: key }, headers: bearer(token) }));
}

async function buy(token: string, litres: number, key: string): Promise<Order> {
  const { primary } = await quote(token, litres);
  return body(await place(token, primary.jws, (await mandateOf(token)).jws, key));
}

async function approverCookie(buyer: string): Promise<string> {
  const response = await session.POST(jsonRequest("/api/v1/console/session", { body: { buyer } }));
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0];
}

beforeEach(() => gateway().reset());

describe("three buyers, one front door", () => {
  it("gives each token its own buyer, agent and signed mandate", async () => {
    const [harbour, kaisla, laine] = await Promise.all([AGENT_TOKEN, KAISLA_TOKEN, LAINE_TOKEN].map(mandateOf));
    expect(harbour.mandate.agent.name).toBe("Harbour purchasing agent");
    expect(kaisla.mandate).toMatchObject({ buyer: { id: BUYER_IDS.kaisla, name: "Kaisla School Kitchens" }, agent: { name: "Kaisla menu planner" } });
    expect(laine.mandate).toMatchObject({ buyer: { name: "Ravintola Laine" }, agent: { name: "Laine kitchen assistant" } });
    expect(new Set([harbour.jws, kaisla.jws, laine.jws]).size).toBe(3);
  });

  it("keeps meaning the primary buyer when a call names none", async () => {
    const response = await new Browser().call(mandate.GET, "/api/v1/mandate");
    expect((await body<{ mandate: { buyer: { id: string } } }>(response)).mandate.buyer.id).toBe(BUYER_IDS.nordicHarbour);
  });

  it("refuses an agent token that asks for another buyer's records", async () => {
    const response = await orders.GET(jsonRequest(`/api/v1/orders?buyer=${BUYER_IDS.nordicHarbour}`, { headers: bearer(KAISLA_TOKEN) }));
    expect(response.status).toBe(403);
    expect((await body<{ code: string }>(response)).code).toBe("other_buyer");
  });
});

describe.skipIf(!hasFixtures)("isolation between buyers", () => {
  it("never counts one buyer's spend against another's weekly limit", async () => {
    for (const key of ["harbour-week-1", "harbour-week-2", "harbour-week-3"]) {
      expect((await buy(AGENT_TOKEN, 1000, key)).status).toBe("confirmed");
    }
    const kaisla = await buy(KAISLA_TOKEN, 790, "kaisla-week-1");
    expect(kaisla.status).toBe("confirmed");
    expect(kaisla.buyer.id).toBe(BUYER_IDS.kaisla);
    expect(kaisla.decision.checks.find((c) => c.rule === "spend.per_week")?.observed).toBe("797.90 EUR");
  });

  it("blocks an agent that presents another buyer's mandate, and files the attempt under its own buyer", async () => {
    const { primary } = await quote(KAISLA_TOKEN, 100);
    const response = await place(KAISLA_TOKEN, primary.jws, (await mandateOf(AGENT_TOKEN)).jws, "kaisla-borrowed-mandate");
    expect(response.status).toBe(422);
    const attempt = (await body<{ order: Order }>(response)).order;
    expect(attempt.status).toBe("blocked");
    expect(attempt.buyer.id).toBe(BUYER_IDS.kaisla);
    expect(attempt.decision.checks.find((c) => c.rule === "mandate.validity")).toMatchObject({
      status: "block",
      message: "The mandate is for Harbour purchasing agent, not for agent agent:kaisla-menu-planner.",
    });
    expect(await gateway().listOrders(BUYER_IDS.nordicHarbour)).toEqual([]);
  });

  it("blocks an offer made for another buyer", async () => {
    const { primary } = await quote(AGENT_TOKEN, 100);
    expect(primary.offer.buyer).toEqual({ id: BUYER_IDS.nordicHarbour, name: "Nordic Harbour Hotels" });
    const response = await place(KAISLA_TOKEN, primary.jws, (await mandateOf(KAISLA_TOKEN)).jws, "kaisla-borrowed-offer");
    expect(response.status).toBe(422);
    const attempt = (await body<{ order: Order }>(response)).order;
    expect(attempt.status).toBe("blocked");
    expect(attempt.decision.checks.find((c) => c.rule === "mandate.validity")?.message).toBe(
      "The offer was made for Nordic Harbour Hotels, not Kaisla School Kitchens.",
    );
  });

  it("hides one buyer's orders from another buyer's agent over REST and MCP", async () => {
    const harbour = await buy(AGENT_TOKEN, 100, "harbour-hidden-1");
    const read = (token: string) => order.GET(jsonRequest(`/api/v1/orders/${harbour.id}`, { headers: bearer(token) }), params({ id: harbour.id }));
    expect((await read(AGENT_TOKEN)).status).toBe(200);
    expect((await read(KAISLA_TOKEN)).status).toBe(404);

    const list = await body<{ orders: Order[] }>(await orders.GET(jsonRequest("/api/v1/orders", { headers: bearer(KAISLA_TOKEN) })));
    expect(list.orders).toEqual([]);

    const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_order", arguments: { orderId: harbour.id } } };
    const reply = await body<{ result: { isError?: boolean } }>(await mcp(jsonRequest("/mcp", { body: call, headers: bearer(KAISLA_TOKEN) })));
    expect(reply.result.isError).toBe(true);
  });

  it("refuses an idempotency key another buyer's agent already used", async () => {
    const harbour = await buy(AGENT_TOKEN, 100, "shared-key-0001");
    const { primary } = await quote(KAISLA_TOKEN, 100);
    const response = await place(KAISLA_TOKEN, primary.jws, (await mandateOf(KAISLA_TOKEN)).jws, "shared-key-0001");
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain(harbour.id);
  });

  it("lets an approver see and decide only their own buyer's orders", async () => {
    const waiting = await buy(AGENT_TOKEN, 1600, "harbour-over-limit");
    expect(waiting.status).toBe("pending_approval");
    const kaislaCookie = await approverCookie(BUYER_IDS.kaisla);

    const inbox = await body<{ orders: Order[] }>(await approvals.GET(jsonRequest("/api/v1/approvals", { headers: { cookie: kaislaCookie } })));
    expect(inbox.orders).toEqual([]);
    const attempt = await decide.POST(
      jsonRequest(`/api/v1/approvals/${waiting.id}`, { body: { decision: "approved" }, headers: { cookie: kaislaCookie } }),
      params({ orderId: waiting.id }),
    );
    expect(attempt.status).toBe(404);

    const harbourCookie = await approverCookie(BUYER_IDS.nordicHarbour);
    const approved = await decide.POST(
      jsonRequest(`/api/v1/approvals/${waiting.id}`, { body: { decision: "approved" }, headers: { cookie: harbourCookie } }),
      params({ orderId: waiting.id }),
    );
    expect((await body<Order>(approved)).approval?.decidedBy.name).toBe("Maria Lind, Head of Purchasing");
  });

  it("changes only the signed-in approver's own mandate, and never its buyer or agent", async () => {
    const cookie = await approverCookie(BUYER_IDS.laine);
    const patch = { limits: { perOrder: { amount: 600, currency: "EUR" } }, buyer: { id: BUYER_IDS.nordicHarbour, name: "Nordic Harbour Hotels", customerNumber: "123" } };
    const response = await mandate.PUT(jsonRequest("/api/v1/mandate", { method: "PUT", body: patch, headers: { cookie } }));
    const updated = await body<{ mandate: { buyer: { id: string }; limits: { perOrder: { amount: number } }; version: number } }>(response);
    expect(updated.mandate).toMatchObject({ buyer: { id: BUYER_IDS.laine }, limits: { perOrder: { amount: 600 } }, version: 2 });
    expect((await gateway().getMandate()).mandate.limits.perOrder.amount).toBe(1500);
    expect((await gateway().auditLog()).at(-1)).toMatchObject({ event: "mandate.updated", refs: { buyerId: BUYER_IDS.laine } });
  });

  it("records the buyer and client application of each call and filters activity by buyer", async () => {
    const headers = { ...bearer(KAISLA_TOKEN), "x-agent-client": "Cursor" };
    await quotes.POST(jsonRequest("/api/v1/quotes", {
      body: { lines: [{ productId: MILK.productId, quantity: { amount: 10, unit: "l" } }], deliverBy: MILK.deliverBy },
      headers,
    }));
    await quote(AGENT_TOKEN, 10);
    const cookie = await approverCookie(BUYER_IDS.nordicHarbour);
    const read = async (buyer: string) =>
      (await body<{ activity: { buyer?: { id: string }; client?: string; tool?: string }[] }>(
        await activity.GET(jsonRequest(`/api/v1/activity?buyer=${buyer}`, { headers: { cookie } })),
      )).activity.filter((item) => item.tool === "request_quote");
    const kaisla = await read(BUYER_IDS.kaisla);
    expect(kaisla).toHaveLength(1);
    expect(kaisla[0]).toMatchObject({ buyer: { id: BUYER_IDS.kaisla }, client: "Cursor" });
    expect((await read(BUYER_IDS.nordicHarbour)).every((item) => item.buyer?.id === BUYER_IDS.nordicHarbour)).toBe(true);
  });
});
