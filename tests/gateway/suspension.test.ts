import { describe, expect, it } from "vitest";
import { createGateway } from "@/lib/gateway";
import { AgentSuspendedError } from "@/lib/gateway/errors";
import { AGENT, BUYER, makeDeps } from "../support/deps";

const OTHER = { id: "agent:other", name: "Other agent" };
const OPERATOR = { id: "operator:valio-aimo", name: "Valio Aimo operator (demo access)", via: "demo access" };

describe("suspensions in the gateway", () => {
  it("refuses in-process calls by a suspended agent and records the refusal for the activity view", async () => {
    const { deps, audit } = makeDeps();
    const gateway = createGateway(deps);
    await gateway.searchCatalog({ ...AGENT, buyer: BUYER }, { query: "Eila" });
    await gateway.searchCatalog(OTHER, { query: "Eila" });

    await gateway.setAgentSuspension(AGENT.id, { suspended: true }, OPERATOR);
    await expect(gateway.searchCatalog({ ...AGENT, buyer: BUYER }, { query: "Eila" })).rejects.toBeInstanceOf(AgentSuspendedError);
    await expect(gateway.getOrder(AGENT, "ord-x")).rejects.toMatchObject({ status: 403, code: "agent_suspended" });
    expect((await gateway.searchCatalog(OTHER, { query: "Eila" })).hits.length).toBeGreaterThan(0);

    const refused = audit.entries.filter((entry) => entry.event === "access.refused");
    expect(refused.map((entry) => entry.data.call)).toEqual(["search_catalog", "get_order"]);
    expect(refused[0]).toMatchObject({ actor: { type: "supplier" }, refs: { buyerId: BUYER.id } });
    const notes = (await deps.store.activity.list()).filter((item) => item.status === "blocked");
    expect(notes.map((item) => item.title)).toEqual(["Refused search_catalog: the agent is suspended", "Refused get_order: the agent is suspended"]);
  });

  it("lists the suspension in the supplier overview until the agent is resumed", async () => {
    const { deps, clock } = makeDeps();
    const gateway = createGateway(deps);
    await gateway.searchCatalog(AGENT, { query: "Eila" });
    const suspended = await gateway.setAgentSuspension(AGENT.id, { suspended: true, reason: "Unusual volume." }, OPERATOR);
    expect(suspended).toMatchObject({ suspended: true, suspendedAt: clock.current.toISOString(), reason: "Unusual volume." });
    expect((await gateway.supplierOverview()).agents[0]).toMatchObject({ status: "suspended", reason: "Unusual volume." });

    await gateway.setAgentSuspension(AGENT.id, { suspended: false }, OPERATOR);
    expect((await gateway.supplierOverview()).agents[0].status).toBe("active");
    expect((await gateway.searchCatalog(AGENT, { query: "Eila" })).hits.length).toBeGreaterThan(0);
  });

  it("names the operator in the signed entries, and says when demo access was used", async () => {
    const { deps, audit } = makeDeps();
    const gateway = createGateway(deps);
    await gateway.searchCatalog(AGENT, { query: "Eila" });
    await gateway.setAgentSuspension(AGENT.id, { suspended: true }, OPERATOR);
    await gateway.setAgentSuspension(AGENT.id, { suspended: false }, OPERATOR);
    const changes = audit.entries.filter((entry) => entry.event === "agent.suspended" || entry.event === "agent.resumed");
    expect(changes).toHaveLength(2);
    for (const entry of changes) {
      expect(entry.actor).toMatchObject({ id: OPERATOR.id, name: OPERATOR.name });
      expect(entry.data).toMatchObject({ operator: { id: OPERATOR.id, name: OPERATOR.name }, via: "demo access" });
      expect(entry.summary.startsWith("Valio Aimo operator (demo access) ")).toBe(true);
    }
  });

  it("rejects a malformed request", async () => {
    const { deps } = makeDeps();
    const gateway = createGateway(deps);
    await gateway.searchCatalog(AGENT, { query: "Eila" });
    await expect(gateway.setAgentSuspension(AGENT.id, { suspended: "yes" } as never, OPERATOR)).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("is cleared by a reset", async () => {
    const { deps } = makeDeps();
    const gateway = createGateway(deps);
    await gateway.searchCatalog(AGENT, { query: "Eila" });
    await gateway.setAgentSuspension(AGENT.id, { suspended: true }, OPERATOR);
    await gateway.reset();
    expect(await deps.store.suspensions.list()).toEqual([]);
  });
});
