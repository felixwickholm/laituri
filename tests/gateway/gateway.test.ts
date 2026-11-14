import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/gateway/errors";
import { createGateway } from "@/lib/gateway/gateway";
import { AGENT, makeDeps } from "../support/deps";
import { DELIVER_BY } from "../support/products";

describe("gateway", () => {
  it("records activity and the audit sequence for search, quote and an auto-approved order", async () => {
    const env = makeDeps();
    const gateway = createGateway(env.deps);

    const search = await gateway.searchCatalog(AGENT, { query: "Eila" });
    expect(search.hits.length).toBeGreaterThan(0);
    const quoted = await gateway.requestQuote(AGENT, {
      lines: [{ productId: "464306", quantity: { amount: 1000, unit: "l" } }],
      deliverBy: DELIVER_BY,
    });
    const { jws: mandateJws } = await gateway.getMandate();
    const order = await gateway.placeOrder(AGENT, { offerJws: quoted.primary.jws, mandateJws, idempotencyKey: "gateway-key-1" });
    expect(order.status).toBe("confirmed");

    const audit = await gateway.auditLog();
    expect(audit.map((e) => e.event)).toEqual([
      "agent.connected",
      "catalog.searched",
      "offer.issued",
      "order.requested",
      "policy.evaluated",
      "order.confirmed",
    ]);
    expect(audit[2]).toMatchObject({
      actor: { type: "supplier" },
      refs: { offerId: quoted.primary.offer.id },
      summary: "Valio Aimo offered 1,000 x Valio Eila 1 l for 1,010.00 EUR, delivered Monday 16 Nov.",
      data: { fulfilment: "full", alternatives: 0 },
    });
    expect(audit[3].actor).toEqual({ type: "agent", ...AGENT });

    const activity = await gateway.activity();
    expect(activity.map((a) => [a.kind, a.title, a.status])).toEqual([
      ["note", "Harbour purchasing agent connected", "ok"],
      ["tool", "Searched the catalogue for 'Eila'", "ok"],
      ["tool", "Asked for a quote for 1,000 l of Valio Eila 1 l", "ok"],
      ["tool", "Placed an order for 1,000 x Valio Eila 1 l", "ok"],
    ]);
    expect(activity[1].detail).toMatch(/^\d+ products?, best match /);
    expect(activity[2].detail).toBe("Full offer, 1,010.00 EUR net");
    expect(activity[3]).toMatchObject({ detail: "Confirmed, 1,010.00 EUR net, receipt signed", refs: { orderId: order.id } });
    expect(await gateway.activity(activity[1].id)).toHaveLength(2);
  });

  it("routes approvals and records mandate changes", async () => {
    const env = makeDeps();
    const gateway = createGateway(env.deps);
    const quoted = await gateway.requestQuote(AGENT, {
      lines: [{ productId: "464306", quantity: { amount: 2000, unit: "l" } }],
      deliverBy: DELIVER_BY,
    });
    const { jws: mandateJws } = await gateway.getMandate();
    const order = await gateway.placeOrder(AGENT, { offerJws: quoted.primary.jws, mandateJws, idempotencyKey: "gateway-key-2" });
    expect(order.status).toBe("pending_approval");
    expect((await gateway.activity()).at(-1)?.status).toBe("waiting");

    const confirmed = await gateway.decideApproval(order.id, { decision: "approved" });
    expect(confirmed.status).toBe("confirmed");
    expect((await gateway.auditLog()).slice(-2).map((e) => e.event)).toEqual(["approval.granted", "order.confirmed"]);

    const updated = await gateway.updateMandate({ delivery: { allowPartial: true, maxDelayDays: 1 } });
    expect(updated.mandate.version).toBe(2);
    expect((await gateway.auditLog()).at(-1)).toMatchObject({ event: "mandate.updated", actor: { type: "human" } });
  });

  it("validates input, records errors and connects each agent once", async () => {
    const env = makeDeps();
    const gateway = createGateway(env.deps);
    await expect(gateway.requestQuote(AGENT, { lines: [], deliverBy: DELIVER_BY })).rejects.toBeInstanceOf(ValidationError);
    await expect(gateway.getProduct(AGENT, "nope")).rejects.toMatchObject({ status: 404, code: "not_found" });
    await gateway.getProduct(AGENT, "464306");
    const activity = await gateway.activity();
    expect(activity.map((a) => a.status)).toEqual(["ok", "error", "ok"]);
    expect((await gateway.auditLog()).filter((e) => e.event === "agent.connected")).toHaveLength(1);

    await gateway.reset();
    expect(await gateway.activity()).toEqual([]);
    await gateway.getProduct(AGENT, "464306");
    expect((await gateway.auditLog()).map((e) => e.event)).toEqual(["agent.connected"]);
  });
});
