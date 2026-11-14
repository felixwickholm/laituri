import { AGENT_TOKEN, jsonRequest, params } from "./env";
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as mandate from "@/app/api/v1/mandate/route";
import * as search from "@/app/api/v1/products/search/route";
import * as overview from "@/app/api/v1/supplier/overview/route";
import * as suspension from "@/app/api/v1/supplier/agents/[agentId]/suspension/route";
import { POST as mcp } from "@/app/mcp/route";
import { SupplierOverview, SuspensionState } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { store } from "@/lib/store";

const hasCatalog = [".data/catalog.json", "fixtures/upstream/catalog.json"].some((file) => existsSync(path.resolve(file)));

const HARBOUR_AGENT = "agent:harbour-purchasing";
const harbour = { authorization: `Bearer ${AGENT_TOKEN}` };
const kaisla = { authorization: "Bearer demo-kaisla-token" };

const searchAs = (headers: Record<string, string>) =>
  search.POST(jsonRequest("/api/v1/products/search", { body: { query: "unobtainium" }, headers }));

function setSuspension(body: unknown, headers: Record<string, string> = {}, agentId = HARBOUR_AGENT) {
  const url = `/api/v1/supplier/agents/${encodeURIComponent(agentId)}/suspension`;
  return suspension.POST(jsonRequest(url, { body, headers }), params({ agentId }));
}

function mcpCall(headers: Record<string, string>) {
  return mcp(jsonRequest("/mcp", {
    body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_mandate", arguments: {} } },
    headers: { ...headers, "mcp-protocol-version": "2025-06-18" },
  }));
}

async function agentStatus(agentId: string) {
  const body = SupplierOverview.parse(await (await overview.GET(jsonRequest("/api/v1/supplier/overview"))).json());
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

  it("cannot be done or undone with an agent token", async () => {
    await searchAs(harbour);
    for (const body of [{ suspended: true }, { suspended: false }]) {
      const response = await setSuspension(body, kaisla);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("agent_not_allowed");
    }
    await setSuspension({ suspended: true });
    const selfResume = await setSuspension({ suspended: false }, harbour);
    expect(selfResume.status).toBe(403);
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
    expect(events[0].summary).toBe("Valio Aimo suspended Harbour purchasing agent. Every call it makes is refused until it is resumed. Reason: Checking a complaint.");
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
    const response = await setSuspension({ suspended: true }, {}, "agent:nobody");
    expect(response.status).toBe(404);
  });
});
