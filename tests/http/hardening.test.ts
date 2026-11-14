import { AGENT_TOKEN, jsonRequest } from "./env";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as basketRoute from "@/app/api/v1/baskets/[basketId]/route";
import * as basketsRoute from "@/app/api/v1/baskets/route";
import * as weeklyRoute from "@/app/api/v1/baskets/weekly/route";
import * as session from "@/app/api/v1/console/session/route";
import * as run from "@/app/api/v1/demo/runs/[runId]/route";
import * as runs from "@/app/api/v1/demo/runs/route";
import * as orders from "@/app/api/v1/orders/route";
import * as quotes from "@/app/api/v1/quotes/route";
import * as suspension from "@/app/api/v1/supplier/agents/[agentId]/suspension/route";
import * as speech from "@/app/api/v1/voice/speech/route";
import * as transcribe from "@/app/api/v1/voice/transcribe/route";
import * as workspaceView from "@/app/api/v1/workspace/view/route";
import { POST as mcpPost } from "@/app/mcp/route";
import nextConfig from "../../next.config";
import type { Basket, WorkspaceInfo } from "@/lib/contracts";
import { MAX_BODY_BYTES } from "@/lib/http/handler";
import { proxy } from "@/proxy";
import { store } from "@/lib/store";
import { sandboxes } from "@/lib/workspace";
import { WORKSPACE_COOKIE, isWorkspaceSecret } from "@/lib/workspace/cookie";
import { inWorkspace, sharedWorkspace } from "@/lib/workspace/context";
import { MAX_AUDIO_BYTES } from "@/lib/voice/server";
import { Browser } from "./browser";

process.env.LAITURI_DEMO_STEP_MS = "0";

const fromAddress = (address: string) => ({ "x-real-ip": address });
const forgedCookie = (value: string) => ({ cookie: `${WORKSPACE_COOKIE}=${value}` });
/** A cookie in the old, unsigned shape: 43 base64url characters anyone can make up. */
const madeUp = () => crypto.randomUUID().replace(/-/g, "").padEnd(43, "Q");

/** A request whose body arrives as a stream with no Content-Length, as chunked uploads do. */
function streamed(pathname: string, bytes: number, headers: Record<string, string> = {}): Request {
  const chunk = new Uint8Array(16 * 1024).fill(32);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) return controller.close();
      sent += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  return new Request(`http://localhost:3299${pathname}`, { method: "POST", body, headers, duplex: "half" } as RequestInit);
}

async function sharedAudit() {
  return inWorkspace(sharedWorkspace(), async () => store().audit.list());
}

describe("1. a made-up workspace cookie never makes a sandbox", () => {
  it("treats a well-formed cookie the server did not issue as no cookie at all", async () => {
    const before = sandboxes().size();
    for (let index = 0; index < 20; index++) {
      const response = await orders.GET(jsonRequest("/api/v1/orders", { headers: { ...forgedCookie(madeUp()), ...fromAddress("198.51.100.20") } }));
      expect(response.status).toBe(401);
    }
    expect(sandboxes().size()).toBe(before);
  });

  it("gives a page load with a made-up cookie a fresh signed one, and keeps an issued one", () => {
    const forged = proxy(new NextRequest("http://localhost:3299/buyer", { headers: forgedCookie(madeUp()) }));
    const issued = forged.cookies.get(WORKSPACE_COOKIE)?.value;
    expect(isWorkspaceSecret(issued)).toBe(true);
    const again = proxy(new NextRequest("http://localhost:3299/buyer", { headers: forgedCookie(issued!) }));
    expect(again.cookies.get(WORKSPACE_COOKIE)).toBeUndefined();
  });

  afterEach(() => {
    delete process.env.LAITURI_SANDBOX_BROWSER_PER_10_MIN;
  });

  it("limits how many sandboxes issued browser cookies from one address start", async () => {
    process.env.LAITURI_SANDBOX_BROWSER_PER_10_MIN = "3";
    const start = () => new Browser().call(orders.GET, "/api/v1/orders", { headers: fromAddress("198.51.100.21") });
    for (let index = 0; index < 3; index++) expect((await start()).status).toBe(200);
    const refused = await start();
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ code: "too_many_sandboxes" });
    expect((await new Browser().call(orders.GET, "/api/v1/orders", { headers: fromAddress("198.51.100.22") })).status).toBe(200);
  });

  it("counts switching back to a sandbox against the same allowance", async () => {
    process.env.LAITURI_SANDBOX_BROWSER_PER_10_MIN = "3";
    const back = () => new Browser().call(workspaceView.POST, "/api/v1/workspace/view", { body: { view: "sandbox" }, headers: fromAddress("198.51.100.23") });
    for (let index = 0; index < 3; index++) expect((await back()).status).toBe(200);
    expect((await back()).status).toBe(429);
  });
});

describe("2. bodies are capped before they are read", () => {
  it("refuses a declared Content-Length over the cap with 413 payload_too_large", async () => {
    const browser = new Browser();
    const response = await browser.call(quotes.POST, "/api/v1/quotes", {
      body: "{}",
      headers: { "content-length": String(MAX_BODY_BYTES + 1) },
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ status: 413, code: "payload_too_large", title: "Payload too large" });
  });

  it("stops reading a streamed body as soon as it passes the cap", async () => {
    const browser = new Browser();
    const response = await quotes.POST(streamed("/api/v1/quotes", 1024 * 1024, { cookie: browser.cookie(), "content-type": "application/json" }));
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("payload_too_large");
  });

  it("caps an MCP body the same way", async () => {
    const response = await mcpPost(streamed("/mcp", 1024 * 1024, { "content-type": "application/json" }));
    expect(response.status).toBe(413);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("caps a recording before buffering it", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    try {
      const browser = new Browser();
      const response = await transcribe.POST(streamed("/api/v1/voice/transcribe", MAX_AUDIO_BYTES + 64 * 1024, { cookie: browser.cookie() }));
      expect(response.status).toBe(413);
    } finally {
      delete process.env.ELEVENLABS_API_KEY;
    }
  });
});

describe("3. a caller with no credential cannot change the shared workspace", () => {
  it("refuses an anonymous demo run and an anonymous quote with 401", async () => {
    const started = await runs.POST(jsonRequest("/api/v1/demo/runs", { body: { scenario: "milk" } }));
    expect(started.status).toBe(401);
    expect((await started.json()).code).toBe("credential_required");
    const quoted = await quotes.POST(jsonRequest("/api/v1/quotes", { body: { lines: [{ productId: "464306", quantity: { amount: 1, unit: "l" } }] } }));
    expect(quoted.status).toBe(401);
  });

  it("logs no access.refused entry for a caller who showed nothing", async () => {
    const before = (await sharedAudit()).length;
    for (let index = 0; index < 5; index++) {
      const response = await suspension.POST(
        jsonRequest("/api/v1/supplier/agents/agent:x/suspension", { body: { suspended: true }, headers: { authorization: "Bearer made-up" } }),
        { params: Promise.resolve({ agentId: "agent:x" }) },
      );
      expect(response.status).toBe(403);
    }
    expect((await sharedAudit()).length).toBe(before);
  });
});

describe("4. voice serves only a browser sandbox or a session", () => {
  const upstream = vi.fn<typeof fetch>();
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ELEVENLABS_API_KEY;
  });

  it("refuses a caller with no credential before any paid call", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    upstream.mockResolvedValue(new Response(new Uint8Array([1]), { headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await speech.POST(jsonRequest("/api/v1/voice/speech", { body: { text: "Hello." } }));
    expect(response.status).toBe(401);
    const streamedSpeech = await speech.GET(jsonRequest("/api/v1/voice/speech?text=Hello"));
    expect(streamedSpeech.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("limits voice calls per workspace", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    upstream.mockImplementation(async () => new Response(new Uint8Array([1]), { headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", upstream);
    const browser = new Browser();
    const say = () => browser.call(speech.POST, "/api/v1/voice/speech", { body: { text: "Hello." }, headers: fromAddress("198.51.100.30") });
    const statuses: number[] = [];
    for (let index = 0; index < 101; index++) statuses.push((await say()).status);
    expect(statuses.slice(0, 100).every((status) => status === 200)).toBe(true);
    expect(statuses[100]).toBe(429);
    delete process.env.ELEVENLABS_VOICE_ID;
  });
});

describe("7 and 8. baskets: an Idempotency-Key retry orders once, and an agent key makes an agent basket", () => {
  const lines = [{ words: "lactose-free milk", quantity: { amount: 10, unit: "l" } }];

  it("answers a retry with the same key with the first basket, and a changed body with 409", async () => {
    const browser = new Browser();
    const headers = { "idempotency-key": "basket-retry-0001" };
    const first = await browser.call(basketsRoute.POST, "/api/v1/baskets", { body: { deliverBy: "2026-11-16", lines }, headers });
    const second = await browser.call(basketsRoute.POST, "/api/v1/baskets", { body: { deliverBy: "2026-11-16", lines }, headers });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    const [one, two] = [(await first.json()).basketId, (await second.json()).basketId];
    expect(two).toBe(one);
    expect(second.headers.get("location")).toBe(`/api/v1/baskets/${one}`);
    const changed = await browser.call(basketsRoute.POST, "/api/v1/baskets", { body: { deliverBy: "2026-11-17", lines }, headers });
    expect(changed.status).toBe(409);
    const weekly = { "idempotency-key": "weekly-retry-0001" };
    const w1 = await (await browser.call(weeklyRoute.POST, "/api/v1/baskets/weekly", { method: "POST", headers: weekly })).json();
    const w2 = await (await browser.call(weeklyRoute.POST, "/api/v1/baskets/weekly", { method: "POST", headers: weekly })).json();
    expect(w2.basketId).toBe(w1.basketId);
  });

  it("records an agent key's basket as source agent even when the body says manual", async () => {
    const created = (await (await new Browser({ sandbox: false }).call((await import("@/app/api/v1/workspace/route")).POST, "/api/v1/workspace", { method: "POST", headers: fromAddress("198.51.100.40") })).json()) as WorkspaceInfo;
    const key = created.agentKeys[0].key;
    const started = await basketsRoute.POST(jsonRequest("/api/v1/baskets", { body: { deliverBy: "2026-11-16", source: "manual", lines }, headers: { authorization: `Bearer ${key}` } }));
    expect(started.status).toBe(202);
    const { basketId } = await started.json();
    const basket = (await (await basketRoute.GET(jsonRequest(`/api/v1/baskets/${basketId}`, { headers: { authorization: `Bearer ${key}` } }), { params: Promise.resolve({ basketId }) })).json()) as Basket;
    expect(basket.source).toBe("agent");
  });
});

describe("9. security headers and same-origin writes", () => {
  it("sets a nonce Content-Security-Policy on a page, no framing from elsewhere", () => {
    const response = proxy(new NextRequest("http://localhost:3299/buyer"));
    const policy = response.headers.get("content-security-policy")!;
    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("sends nosniff, a referrer policy, the microphone for this origin only, and no X-Powered-By", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const [{ headers }] = await nextConfig.headers!();
    const byName = Object.fromEntries(headers.map((header) => [header.key, header.value]));
    expect(byName).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": expect.stringContaining("microphone=(self)"),
    });
  });

  it("refuses a cookie-carrying write from another site", async () => {
    const browser = new Browser();
    const crossSite = await browser.call(runs.POST, "/api/v1/demo/runs", { body: { scenario: "milk" }, headers: { "sec-fetch-site": "cross-site" } });
    expect(crossSite.status).toBe(403);
    expect((await crossSite.json()).code).toBe("cross_site_request");
    const otherOrigin = await browser.call(runs.POST, "/api/v1/demo/runs", { body: { scenario: "milk" }, headers: { origin: "https://evil.example" } });
    expect(otherOrigin.status).toBe(403);
    const sameOrigin = await browser.call(runs.POST, "/api/v1/demo/runs", { body: { scenario: "milk" }, headers: { "sec-fetch-site": "same-origin" } });
    expect(sameOrigin.status).toBe(202);
  });
});

describe("10. wrong passcodes from one address wait", () => {
  afterEach(() => {
    delete process.env.LAITURI_APPROVER_PASSCODE;
  });

  it("refuses even the right passcode with 429 after ten wrong ones", async () => {
    process.env.LAITURI_APPROVER_PASSCODE = "right-passcode";
    const browser = new Browser();
    const signIn = (passcode: string) => browser.call(session.POST, "/api/v1/console/session", { body: { passcode }, headers: fromAddress("198.51.100.50") });
    for (let index = 0; index < 10; index++) expect((await signIn("wrong")).status).toBe(403);
    const locked = await signIn("right-passcode");
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
    const elsewhere = await new Browser().call(session.POST, "/api/v1/console/session", { body: { passcode: "right-passcode" }, headers: fromAddress("198.51.100.51") });
    expect(elsewhere.status).toBe(200);
  });
});

describe("11. a demo run is read only with a credential", () => {
  it("answers 401 to a caller with no credential", async () => {
    const browser = new Browser();
    const { runId } = await (await browser.call(runs.POST, "/api/v1/demo/runs", { body: { scenario: "milk" } })).json();
    expect((await browser.call(run.GET, `/api/v1/demo/runs/${runId}`, { params: { runId } })).status).toBe(200);
    const anonymous = await run.GET(jsonRequest(`/api/v1/demo/runs/${runId}`), { params: Promise.resolve({ runId }) });
    expect(anonymous.status).toBe(401);
  });
});

describe("the agent token stays refused where it was", () => {
  it("still refuses an agent on voice", async () => {
    const response = await speech.POST(jsonRequest("/api/v1/voice/speech", { body: { text: "Hi." }, headers: { authorization: `Bearer ${AGENT_TOKEN}` } }));
    expect(response.status).toBe(403);
  });
});
