import { AGENT_TOKEN, jsonRequest, params } from "./env";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as decide from "@/app/api/v1/approvals/[orderId]/route";
import * as session from "@/app/api/v1/console/session/route";
import * as mandate from "@/app/api/v1/mandate/route";
import type { ConsoleSession } from "@/lib/http/console-session";
import { gateway } from "@/lib/gateway";
import { BUYER_IDS } from "@/lib/mandate";
import { MILK } from "@/lib/openapi/examples";
import { DEMO_AGENT } from "@/lib/agent";

const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));

const signIn = (body: unknown, headers: Record<string, string> = {}) =>
  session.POST(jsonRequest("/api/v1/console/session", { body, headers }));

async function demoCookie(): Promise<string> {
  const response = await signIn({ demo: true });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0];
}

async function readSession(cookie?: string): Promise<ConsoleSession> {
  return (await session.GET(jsonRequest("/api/v1/console/session", { headers: cookie ? { cookie } : {} }))).json();
}

beforeEach(async () => {
  await gateway().reset();
  process.env.LAITURI_APPROVER_PASSCODE = "open-sesame";
});

afterEach(() => {
  delete process.env.LAITURI_APPROVER_PASSCODE;
  delete process.env.LAITURI_DEMO_ACCESS;
});

describe("console session", () => {
  it("reports whether demo access is available and which buyers can sign in", async () => {
    const signedOut = await readSession();
    expect(signedOut).toMatchObject({ signedIn: false, mode: "passcode", demoAccess: true });
    expect(signedOut.buyers.map((b) => b.name)).toEqual(["Nordic Harbour Hotels", "Kaisla School Kitchens", "Ravintola Laine"]);
    expect(signedOut.buyers[1].approver.name).toBe("Antti Korhonen, Food Service Manager");
    process.env.LAITURI_DEMO_ACCESS = "off";
    expect((await readSession()).demoAccess).toBe(false);
  });

  it("signs a visitor in as the primary buyer's approver without the passcode, flagged as demo", async () => {
    const response = await signIn({ demo: true });
    const body = (await response.json()) as ConsoleSession;
    expect(body).toMatchObject({ signedIn: true, demo: true, approver: { name: "Maria Lind, Head of Purchasing" }, buyer: { id: BUYER_IDS.nordicHarbour } });
    const token = response.headers.get("set-cookie")!.split(";")[0].split("=")[1];
    expect(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())).toMatchObject({ demo: true, buyer: BUYER_IDS.nordicHarbour });
    expect(await readSession(await demoCookie())).toMatchObject({ signedIn: true, demo: true });
  });

  it("refuses demo access when it is turned off, for another buyer, and for agent credentials", async () => {
    expect((await signIn({ demo: true, buyer: BUYER_IDS.kaisla })).status).toBe(400);
    const agent = await signIn({ demo: true }, { authorization: `Bearer ${AGENT_TOKEN}` });
    expect(agent.status).toBe(403);
    expect((await agent.json()).code).toBe("agent_not_allowed");
    process.env.LAITURI_DEMO_ACCESS = "off";
    const off = await signIn({ demo: true });
    expect(off.status).toBe(403);
    expect((await off.json()).code).toBe("demo_access_off");
  });

  it("ends demo sessions already issued once demo access is turned off", async () => {
    const cookie = await demoCookie();
    process.env.LAITURI_DEMO_ACCESS = "off";
    expect(await readSession(cookie)).toMatchObject({ signedIn: false, demoAccess: false });
    const body = { limits: { perOrder: { amount: 1400, currency: "EUR" } } };
    const refused = await mandate.PUT(jsonRequest("/api/v1/mandate", { method: "PUT", body, headers: { cookie } }));
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe("approver_sign_in_required");
  });

  it("keeps a demo session to the primary buyer, whatever buyer the call names", async () => {
    const cookie = await demoCookie();
    const kaislaBefore = (await gateway().getMandate(BUYER_IDS.kaisla)).mandate;
    const body = { limits: { perOrder: { amount: 1400, currency: "EUR" } } };
    const url = `/api/v1/mandate?buyer=${encodeURIComponent(BUYER_IDS.kaisla)}`;
    expect((await mandate.PUT(jsonRequest(url, { method: "PUT", body, headers: { cookie } }))).status).toBe(200);
    expect((await gateway().getMandate(BUYER_IDS.kaisla)).mandate.version).toBe(kaislaBefore.version);
    expect((await gateway().getMandate(BUYER_IDS.nordicHarbour)).mandate.limits.perOrder.amount).toBe(1400);
  });

  it.skipIf(!hasFixtures)("cannot decide another buyer's order in a demo session", async () => {
    const kaisla = { id: "agent:kaisla-menu-planner", name: "Kaisla menu planner", buyer: { id: BUYER_IDS.kaisla, name: "Kaisla School Kitchens" } };
    const offer = await gateway().requestQuote(kaisla, {
      lines: [{ productId: MILK.productId, quantity: { amount: 1000, unit: "l" } }],
      deliverBy: MILK.deliverBy,
    });
    const { jws } = await gateway().getMandate(BUYER_IDS.kaisla);
    const waiting = await gateway().placeOrder(kaisla, { offerJws: offer.primary.jws, mandateJws: jws, idempotencyKey: "demo-other-buyer-1" });
    expect(waiting.status).toBe("pending_approval");
    const cookie = await demoCookie();
    const response = await decide.POST(
      jsonRequest(`/api/v1/approvals/${waiting.id}`, { body: { decision: "approved" }, headers: { cookie } }),
      params({ orderId: waiting.id }),
    );
    expect(response.status).toBe(404);
    expect((await gateway().listOrders(BUYER_IDS.kaisla)).find((order) => order.id === waiting.id)?.status).toBe("pending_approval");
  });

  it("signs in with the passcode while demo access is on, and while it is off", async () => {
    for (const access of ["on", "off"]) {
      process.env.LAITURI_DEMO_ACCESS = access;
      const response = await signIn({ passcode: "open-sesame" });
      expect(await response.json()).toMatchObject({ signedIn: true, demo: false, mode: "passcode", demoAccess: access === "on" });
      const cookie = response.headers.get("set-cookie")!.split(";")[0];
      const body = { limits: { perOrder: { amount: 1400, currency: "EUR" } } };
      expect((await mandate.PUT(jsonRequest("/api/v1/mandate", { method: "PUT", body, headers: { cookie } }))).status).toBe(200);
      const entry = (await gateway().auditLog()).at(-1);
      expect(entry?.event).toBe("mandate.updated");
      expect(entry?.data).not.toHaveProperty("via");
    }
  });

  it("signs in another buyer's approver with the passcode, not flagged as demo", async () => {
    const body = (await (await signIn({ passcode: "open-sesame", buyer: BUYER_IDS.laine })).json()) as ConsoleSession;
    expect(body).toMatchObject({ signedIn: true, demo: false, approver: { name: "Sofia Laine, Owner" }, buyer: { name: "Ravintola Laine" } });
    expect((await signIn({ passcode: "guess", buyer: BUYER_IDS.laine })).status).toBe(403);
    expect((await signIn({ passcode: "open-sesame", buyer: "fi:ovt:unknown" })).status).toBe(400);
  });

  it("says demo access in the signed audit entry of a mandate change", async () => {
    const cookie = await demoCookie();
    const body = { limits: { perOrder: { amount: 1400, currency: "EUR" } } };
    expect((await mandate.PUT(jsonRequest("/api/v1/mandate", { method: "PUT", body, headers: { cookie } }))).status).toBe(200);
    expect((await gateway().auditLog()).at(-1)).toMatchObject({ event: "mandate.updated", data: { via: "demo access" } });
  });

  it.skipIf(!hasFixtures)("says demo access in the signed audit entry of an approval", async () => {
    const offer = await gateway().requestQuote(DEMO_AGENT, {
      lines: [{ productId: MILK.productId, quantity: { amount: 1600, unit: "l" } }],
      deliverBy: MILK.deliverBy,
    });
    const { jws } = await gateway().getMandate();
    const waiting = await gateway().placeOrder(DEMO_AGENT, { offerJws: offer.primary.jws, mandateJws: jws, idempotencyKey: "demo-access-0001" });
    const cookie = await demoCookie();
    const response = await decide.POST(
      jsonRequest(`/api/v1/approvals/${waiting.id}`, { body: { decision: "approved" }, headers: { cookie } }),
      params({ orderId: waiting.id }),
    );
    expect(response.status).toBe(200);
    const granted = (await gateway().auditLog()).find((entry) => entry.event === "approval.granted");
    expect(granted?.data).toMatchObject({ via: "demo access" });
    expect((await gateway().verifyAudit()).valid).toBe(true);
  });
});
