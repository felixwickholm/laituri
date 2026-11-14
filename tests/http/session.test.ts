import { jsonRequest } from "./env";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as decide from "@/app/api/v1/approvals/[orderId]/route";
import * as audit from "@/app/api/v1/audit/route";
import * as session from "@/app/api/v1/console/session/route";
import * as mandate from "@/app/api/v1/mandate/route";
import * as orders from "@/app/api/v1/orders/route";
import * as quotes from "@/app/api/v1/quotes/route";
import * as workspace from "@/app/api/v1/workspace/route";
import type { AuditEntry, Mandate, Order, QuoteResponse } from "@/lib/contracts";
import type { ConsoleSession } from "@/lib/http/console-session";
import type { WorkspaceInfo } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { BUYER_IDS } from "@/lib/mandate";
import { MILK } from "@/lib/openapi/examples";
import { Browser } from "./browser";

const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));
const LIMIT_CHANGE = { limits: { perOrder: { amount: 1400, currency: "EUR" } } };

async function read<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const signIn = (browser: Browser, body: unknown, headers: Record<string, string> = {}) =>
  browser.call(session.POST, "/api/v1/console/session", { body, headers });

const readSession = async (browser: Browser) => read<ConsoleSession>(await browser.call(session.GET, "/api/v1/console/session"));

const changeLimit = (browser: Browser, url = "/api/v1/mandate") => browser.call(mandate.PUT, url, { method: "PUT", body: LIMIT_CHANGE });

const mandateOf = async (browser: Browser, buyer: string) =>
  (await read<{ mandate: Mandate }>(await browser.call(mandate.GET, `/api/v1/mandate?buyer=${encodeURIComponent(buyer)}`))).mandate;

const lastEntry = async (browser: Browser) => (await read<{ entries: AuditEntry[] }>(await browser.call(audit.GET, "/api/v1/audit"))).entries.at(-1);

/** A waiting order placed in the browser's sandbox with that sandbox's key for `buyerIndex`. */
async function waitingOrder(browser: Browser, buyerIndex: number, litres: number, idempotencyKey: string): Promise<Order> {
  const { key } = (await read<WorkspaceInfo>(await browser.call(workspace.GET, "/api/v1/workspace"))).agentKeys[buyerIndex];
  const headers = { authorization: `Bearer ${key}` };
  const request = { lines: [{ productId: MILK.productId, quantity: { amount: litres, unit: "l" } }], deliverBy: MILK.deliverBy };
  const quote = await read<QuoteResponse>(await quotes.POST(jsonRequest("/api/v1/quotes", { body: request, headers })));
  const { jws } = await read<{ jws: string }>(await mandate.GET(jsonRequest("/api/v1/mandate", { headers })));
  const order = await read<Order>(await orders.POST(jsonRequest("/api/v1/orders", { body: { offerJws: quote.primary.jws, mandateJws: jws, idempotencyKey }, headers })));
  expect(order.status).toBe("pending_approval");
  return order;
}

beforeEach(async () => {
  await gateway().reset();
  process.env.LAITURI_APPROVER_PASSCODE = "open-sesame";
});

afterEach(() => {
  delete process.env.LAITURI_APPROVER_PASSCODE;
  delete process.env.LAITURI_DEMO_ACCESS;
  vi.unstubAllEnvs();
});

describe("console session", () => {
  it("offers demo access in a sandbox only, and names the buyers who can sign in", async () => {
    const sandbox = await readSession(new Browser());
    expect(sandbox).toMatchObject({ signedIn: false, mode: "passcode", demoAccess: true, workspace: "sandbox", operator: { signedIn: false } });
    expect(sandbox.buyers.map((b) => b.name)).toEqual(["Nordic Harbour Hotels", "Kaisla School Kitchens", "Ravintola Laine"]);
    expect(sandbox.buyers[1].approver.name).toBe("Antti Korhonen, Food Service Manager");
    expect(await readSession(new Browser({ sandbox: false }))).toMatchObject({ demoAccess: false, workspace: "shared" });
    process.env.LAITURI_DEMO_ACCESS = "off";
    expect((await readSession(new Browser())).demoAccess).toBe(false);
  });

  it("signs the sandbox's browser in as the primary buyer's approver without the passcode, flagged as demo", async () => {
    const browser = new Browser();
    const response = await signIn(browser, { demo: true });
    expect(response.status).toBe(200);
    expect(await read<ConsoleSession>(response)).toMatchObject({ role: "approver", signedIn: true, demo: true, approver: { name: "Maria Lind, Head of Purchasing" }, buyer: { id: BUYER_IDS.nordicHarbour } });
    expect(await readSession(browser)).toMatchObject({ signedIn: true, demo: true });
  });

  it("refuses demo access to a caller without a sandbox, for another buyer, to agent credentials, and when turned off", async () => {
    const shared = await signIn(new Browser({ sandbox: false }), { demo: true });
    expect(shared.status).toBe(403);
    expect((await read<{ code: string }>(shared)).code).toBe("demo_access_sandbox_only");
    expect((await signIn(new Browser(), { demo: true, buyer: BUYER_IDS.kaisla })).status).toBe(400);
    const agent = await signIn(new Browser(), { demo: true }, { authorization: "Bearer demo-agent-token" });
    expect(agent.status).toBe(403);
    expect((await read<{ code: string }>(agent)).code).toBe("agent_not_allowed");
    process.env.LAITURI_DEMO_ACCESS = "off";
    const off = await signIn(new Browser(), { demo: true });
    expect(off.status).toBe(403);
    expect((await read<{ code: string }>(off)).code).toBe("demo_access_off");
  });

  it("binds a session to the workspace it was issued in", async () => {
    const [owner, other] = [new Browser(), new Browser()];
    await signIn(owner, { demo: true });
    const approverCookie = owner.cookie().split("; ").find((pair) => pair.startsWith("laituri_approver="))!;
    const workspaceCookie = other.cookie();
    const elsewhere = await mandate.PUT(jsonRequest("/api/v1/mandate", { method: "PUT", body: LIMIT_CHANGE, headers: { cookie: `${workspaceCookie}; ${approverCookie}` } }));
    expect(elsewhere.status).toBe(403);
    const inShared = await mandate.PUT(jsonRequest("/api/v1/mandate", { method: "PUT", body: LIMIT_CHANGE, headers: { cookie: approverCookie } }));
    expect(inShared.status).toBe(403);
    expect((await changeLimit(owner)).status).toBe(200);
  });

  it("ends demo sessions already issued once demo access is turned off", async () => {
    const browser = new Browser();
    await signIn(browser, { demo: true });
    process.env.LAITURI_DEMO_ACCESS = "off";
    expect(await readSession(browser)).toMatchObject({ signedIn: false, demoAccess: false });
    const refused = await changeLimit(browser);
    expect(refused.status).toBe(403);
    expect((await read<{ code: string }>(refused)).code).toBe("approver_sign_in_required");
  });

  it("keeps a demo session to the primary buyer, whatever buyer the call names", async () => {
    const browser = new Browser();
    await signIn(browser, { demo: true });
    const kaislaBefore = await mandateOf(browser, BUYER_IDS.kaisla);
    expect((await changeLimit(browser, `/api/v1/mandate?buyer=${encodeURIComponent(BUYER_IDS.kaisla)}`)).status).toBe(200);
    expect((await mandateOf(browser, BUYER_IDS.kaisla)).version).toBe(kaislaBefore.version);
    expect((await mandateOf(browser, BUYER_IDS.nordicHarbour)).limits.perOrder.amount).toBe(1400);
  });

  it.skipIf(!hasFixtures)("cannot decide another buyer's order in a demo session", async () => {
    const browser = new Browser();
    const waiting = await waitingOrder(browser, 1, 1000, "demo-other-buyer-1");
    await signIn(browser, { demo: true });
    const response = await browser.call(decide.POST, `/api/v1/approvals/${waiting.id}`, { body: { decision: "approved" }, params: { orderId: waiting.id } });
    expect(response.status).toBe(404);
  });

  it("signs in with the passcode while demo access is on, and while it is off", async () => {
    for (const access of ["on", "off"]) {
      process.env.LAITURI_DEMO_ACCESS = access;
      const browser = new Browser({ sandbox: false });
      const response = await signIn(browser, { passcode: "open-sesame" });
      expect(await read<ConsoleSession>(response)).toMatchObject({ signedIn: true, demo: false, mode: "passcode", demoAccess: false, workspace: "shared" });
      expect((await changeLimit(browser)).status).toBe(200);
      const entry = await lastEntry(browser);
      expect(entry?.event).toBe("mandate.updated");
      expect(entry?.data).not.toHaveProperty("via");
    }
  });

  it("signs in another buyer's approver with the passcode, not flagged as demo", async () => {
    const body = await read<ConsoleSession>(await signIn(new Browser({ sandbox: false }), { passcode: "open-sesame", buyer: BUYER_IDS.laine }));
    expect(body).toMatchObject({ signedIn: true, demo: false, approver: { name: "Sofia Laine, Owner" }, buyer: { name: "Ravintola Laine" } });
    expect((await signIn(new Browser({ sandbox: false }), { passcode: "guess", buyer: BUYER_IDS.laine })).status).toBe(403);
    expect((await signIn(new Browser({ sandbox: false }), { passcode: "open-sesame", buyer: "fi:ovt:unknown" })).status).toBe(400);
  });

  it("has no network sign-in to the shared workspace on a production server without a passcode", async () => {
    delete process.env.LAITURI_APPROVER_PASSCODE;
    vi.stubEnv("NODE_ENV", "production");
    const browser = new Browser({ sandbox: false });
    expect(await readSession(browser)).toMatchObject({ mode: "closed", demoAccess: false });
    for (const body of [{}, { passcode: "anything" }, { demo: true }]) {
      expect((await signIn(browser, body)).status).toBe(403);
    }
    vi.unstubAllEnvs();
    expect(await readSession(browser)).toMatchObject({ mode: "open" });
  });

  it("says demo access in the signed audit entry of a mandate change", async () => {
    const browser = new Browser();
    await signIn(browser, { demo: true });
    expect((await changeLimit(browser)).status).toBe(200);
    expect(await lastEntry(browser)).toMatchObject({ event: "mandate.updated", data: { via: "demo access" } });
  });

  it.skipIf(!hasFixtures)("says demo access in the signed audit entry of an approval", async () => {
    const browser = new Browser();
    const waiting = await waitingOrder(browser, 0, 1600, "demo-access-0001");
    await signIn(browser, { demo: true });
    const response = await browser.call(decide.POST, `/api/v1/approvals/${waiting.id}`, { body: { decision: "approved" }, params: { orderId: waiting.id } });
    expect(response.status).toBe(200);
    const entries = (await read<{ entries: AuditEntry[] }>(await browser.call(audit.GET, "/api/v1/audit"))).entries;
    expect(entries.find((entry) => entry.event === "approval.granted" && entry.refs.orderId === waiting.id)?.data).toMatchObject({ via: "demo access" });
  });
});

describe("one browser, both sides of the tour", () => {
  it("holds an approver session and an operator session at once, and signs out one of them", async () => {
    const browser = new Browser();
    await signIn(browser, { demo: true });
    const operator = await signIn(browser, { demo: true, role: "operator" });
    expect(await read<ConsoleSession>(operator)).toMatchObject({
      role: "operator",
      signedIn: true,
      operator: { signedIn: true, demo: true, operator: { name: "Valio Aimo operator (demo access)" } },
    });
    expect(await readSession(browser)).toMatchObject({ signedIn: true, operator: { signedIn: true } });
    await browser.call(session.DELETE, "/api/v1/console/session?role=operator", { method: "DELETE" });
    expect(await readSession(browser)).toMatchObject({ signedIn: true, operator: { signedIn: false } });
  });

  it("refuses an operator sign-in for one buyer", async () => {
    expect((await signIn(new Browser(), { demo: true, role: "operator", buyer: BUYER_IDS.kaisla })).status).toBe(400);
  });

  it("signs the shared workspace's operator in with LAITURI_OPERATOR_PASSCODE only", async () => {
    vi.stubEnv("LAITURI_OPERATOR_PASSCODE", "harbour-lights");
    const browser = new Browser({ sandbox: false });
    expect((await signIn(browser, { role: "operator", demo: true })).status).toBe(403);
    expect((await signIn(browser, { role: "operator", passcode: "open-sesame" })).status).toBe(403);
    const signed = await read<ConsoleSession>(await signIn(browser, { role: "operator", passcode: "harbour-lights" }));
    expect(signed.operator).toMatchObject({ signedIn: true, demo: false, mode: "passcode", operator: { name: "Valio Aimo operator" } });
  });
});
