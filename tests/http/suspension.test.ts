import { AGENT_TOKEN, jsonRequest, params } from "./env";
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as session from "@/app/api/v1/console/session/route";
import * as audit from "@/app/api/v1/audit/route";
import * as mandate from "@/app/api/v1/mandate/route";
import * as search from "@/app/api/v1/products/search/route";
import * as overview from "@/app/api/v1/supplier/overview/route";
import * as suspension from "@/app/api/v1/supplier/agents/[agentId]/suspension/route";
import { POST as mcp } from "@/app/mcp/route";
import { SupplierOverview, SuspensionState } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { store } from "@/lib/store";
import * as workspace from "@/app/api/v1/workspace/route";
import type { WorkspaceInfo } from "@/lib/contracts";
import { Browser } from "./browser";

const hasCatalog = [".data/catalog.json", "fixtures/upstream/catalog.json"].some((file) => existsSync(path.resolve(file)));

const HARBOUR_AGENT = "agent:harbour-purchasing";
const harbour = { authorization: `Bearer ${AGENT_TOKEN}` };
const kaisla = { authorization: "Bearer demo-kaisla-token" };

const searchAs = (headers: Record<string, string>) =>
  search.POST(jsonRequest("/api/v1/products/search", { body: { query: "unobtainium" }, headers }));

/** The shared workspace's operator, signed in the open way a local development server allows. */
async function operatorCookie(): Promise<string> {
  const response = await session.POST(jsonRequest("/api/v1/console/session", { body: { role: "operator" } }));
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0];
}

async function setSuspension(body: unknown, headers?: Record<string, string>, agentId = HARBOUR_AGENT) {
  const url = `/api/v1/supplier/agents/${encodeURIComponent(agentId)}/suspension`;
  return suspension.POST(jsonRequest(url, { body, headers: headers ?? { cookie: await operatorCookie() } }), params({ agentId }));
}

function mcpCall(headers: Record<string, string>) {
  return mcp(jsonRequest("/mcp", {
    body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_mandate", arguments: {} } },
    headers: { ...headers, "mcp-protocol-version": "2025-06-18" },
  }));
}

async function agentStatus(agentId: string) {
  const headers = { cookie: await operatorCookie() };
  const body = SupplierOverview.parse(await (await overview.GET(jsonRequest("/api/v1/supplier/overview", { headers }))).json());
  return body.agents.find((agent) => agent.agent.id === agentId);
}

beforeEach(async () => {
  await gateway().reset();
});

describe.skipIf(!hasCatalog)("suspending an agent", () => {
  it("refuses every call by the suspended agent, over REST and MCP, with a plain sentence", async () => {
    expect((await searchAs(harbour)).status).toBe(200);
    const suspended = await setSuspension({ suspended: true, reason: "Ordering far more than usual." });
    expect(suspended.status).toBe(200);
    expect(SuspensionState.parse(await suspended.json())).toMatchObject({
      agent: { id: HARBOUR_AGENT },
      buyer: { name: "Nordic Harbour Hotels" },
      suspended: true,
      reason: "Ordering far more than usual.",
    });

    for (const response of [await searchAs(harbour), await mandate.GET(jsonRequest("/api/v1/mandate", { headers: harbour })), await mcpCall(harbour)]) {
      expect(response.status).toBe(403);
      const problem = await response.json();
      expect(problem.code).toBe("agent_suspended");
      expect(problem.detail).toBe(
        "Valio Aimo has suspended Harbour purchasing agent, so it refuses every call until the agent is resumed. Reason: Ordering far more than usual.",
      );
    }
  });

  it("leaves other agents unaffected", async () => {
    await searchAs(harbour);
    await setSuspension({ suspended: true });
    expect((await searchAs(kaisla)).status).toBe(200);
    expect((await mcpCall(kaisla)).status).toBe(200);
  });

  it("serves the agent again once resumed, and shows the state in the supplier overview", async () => {
    await searchAs(harbour);
    await setSuspension({ suspended: true, reason: "Checking a complaint." });
    expect(await agentStatus(HARBOUR_AGENT)).toMatchObject({ status: "suspended", reason: "Checking a complaint.", suspendedAt: expect.any(String) });

    const resumed = await setSuspension({ suspended: false });
    expect(await resumed.json()).toEqual({ agent: { id: HARBOUR_AGENT, name: "Harbour purchasing agent" }, buyer: expect.any(Object), suspended: false });
    expect((await searchAs(harbour)).status).toBe(200);
    const status = await agentStatus(HARBOUR_AGENT);
    expect(status?.status).toBe("active");
    expect(status).not.toHaveProperty("suspendedAt");
  });

  it("cannot be done or undone with an agent token, without a session, or with an approver's session", async () => {
    await searchAs(harbour);
    const approver = (await session.POST(jsonRequest("/api/v1/console/session", { body: {} }))).headers.get("set-cookie")!.split(";")[0];
    const attempts: [Record<string, string>, string][] = [
      [kaisla, "agent_not_allowed"],
      [{}, "operator_sign_in_required"],
      [{ cookie: approver }, "operator_sign_in_required"],
    ];
    for (const [headers, code] of attempts) {
      for (const body of [{ suspended: true }, { suspended: false }]) {
        const response = await setSuspension(body, headers);
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe(code);
      }
    }
    const refused = (await store().audit.list()).filter((entry) => entry.event === "access.refused" && entry.data.action === "suspension");
    expect(refused).toHaveLength(attempts.length * 2);
    expect(refused[1].summary).toBe(`An agent with a token tried to suspend or resume ${HARBOUR_AGENT}. Refused: only a signed-in Valio Aimo operator can.`);
    expect((await gateway().verifyAudit()).valid).toBe(true);
  });

  it("cannot be undone by the suspended agent, with its token or without it", async () => {
    await searchAs(harbour);
    await setSuspension({ suspended: true });
    const withToken = await setSuspension({ suspended: false }, harbour);
    expect(withToken.status).toBe(403);
    expect((await withToken.json()).code).toBe("agent_suspended");
    const withoutToken = await setSuspension({ suspended: false }, {});
    expect(withoutToken.status).toBe(403);
    expect((await withoutToken.json()).code).toBe("operator_sign_in_required");
    expect((await searchAs(harbour)).status).toBe(403);
  });

  it("writes the suspension, each refused call and the resumption to a log that still verifies", async () => {
    await searchAs(harbour);
    await setSuspension({ suspended: true, reason: "Checking a complaint." });
    await searchAs(harbour);
    await mcpCall(harbour);
    await setSuspension({ suspended: false });

    const entries = await store().audit.list();
    const events = entries.filter((entry) => entry.actor.type === "supplier" && entry.event !== "offer.issued");
    expect(events.map((entry) => entry.event)).toEqual(["agent.suspended", "access.refused", "access.refused", "agent.resumed"]);
    expect(events[0].summary).toBe("Valio Aimo operator suspended Harbour purchasing agent for Valio Aimo. Every call it makes is refused until it is resumed. Reason: Checking a complaint.");
    expect(events[0].actor).toMatchObject({ id: "operator:valio-aimo", name: "Valio Aimo operator" });
    expect(events[0].data).not.toHaveProperty("via");
    expect(events.slice(1, 3).map((entry) => entry.data.call)).toEqual(["POST /api/v1/products/search", "MCP tools/call get_mandate"]);
    expect(events.slice(1, 3).every((entry) => entry.data.code === "agent_suspended")).toBe(true);
    expect((await gateway().verifyAudit()).valid).toBe(true);
  });

  it("changes nothing when the agent is already in the state asked for", async () => {
    await searchAs(harbour);
    const before = (await store().audit.list()).length;
    expect(await (await setSuspension({ suspended: false })).json()).toMatchObject({ suspended: false });
    expect(await store().audit.list()).toHaveLength(before);
  });

  it("does not know an agent that never reached the wholesaler", async () => {
    const response = await setSuspension({ suspended: true }, undefined, "agent:nobody");
    expect(response.status).toBe(404);
  });

  it("gives a sandbox's browser a demo operator who suspends that sandbox's agent only, and says so in the log", async () => {
    const browser = new Browser();
    const { agentKeys } = (await (await browser.call(workspace.GET, "/api/v1/workspace")).json()) as WorkspaceInfo;
    const laine = agentKeys[2];
    const asLaine = { authorization: `Bearer ${laine.key}` };
    expect((await searchAs(asLaine)).status).toBe(200);
    const url = `/api/v1/supplier/agents/${encodeURIComponent(laine.agent.id)}/suspension`;
    const change = (body: unknown, headers: Record<string, string> = {}) => browser.call(suspension.POST, url, { body, headers, params: { agentId: laine.agent.id } });

    expect((await change({ suspended: true })).status).toBe(403);
    await browser.call(session.POST, "/api/v1/console/session", { body: { demo: true, role: "operator" } });
    expect((await change({ suspended: true, reason: "Testing." })).status).toBe(200);
    expect((await searchAs(asLaine)).status).toBe(403);
    expect((await searchAs({ authorization: "Bearer demo-laine-token" })).status).toBe(200);
    expect((await change({ suspended: false }, asLaine)).status).toBe(403);
    expect((await change({ suspended: false })).status).toBe(200);
    expect((await searchAs(asLaine)).status).toBe(200);

    const log = (await (await browser.call(audit.GET, "/api/v1/audit")).json()) as { entries: { event: string; summary: string; data: Record<string, unknown> }[] };
    const changes = log.entries.filter((entry) => entry.event === "agent.suspended" || entry.event === "agent.resumed");
    expect(changes.map((entry) => entry.data.via)).toEqual(["demo access", "demo access"]);
    expect(changes[0].summary).toBe("Valio Aimo operator (demo access) suspended Laine kitchen assistant for Valio Aimo. Every call it makes is refused until it is resumed. Reason: Testing.");
  });
});
