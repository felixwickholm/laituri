import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, StateError, ValidationError } from "@/lib/gateway/errors";
import { decideApproval, getOrder, pendingApprovals, placeOrder } from "@/lib/orders";
import type { ReceiptPayload } from "@/lib/orders";
import { TOKEN_TYPE } from "@/lib/trust/types";
import { AGENT, BUYER } from "../support/deps";
import { setup } from "./helpers";

const KEY = "order-key-0001";
const DECIDER = { buyerId: BUYER.id };
const OTHER_AGENT = { id: "agent:kaisla-menu-planner", name: "Kaisla menu planner", buyer: { id: "buyer:kaisla", name: "Kaisla School Kitchens" } };

describe("placeOrder", () => {
  it("confirms an order inside the mandate with a receipt that verifies", async () => {
    const env = await setup();
    const order = await placeOrder({ offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: KEY }, env.deps, AGENT);

    expect(order).toMatchObject({ status: "confirmed", simulated: true, agent: AGENT, mandateId: "mandate:test" });
    expect(order.id).toMatch(/^ord_[a-z2-7]{10}$/);
    const receipt = await env.trust.verify<ReceiptPayload>("supplier", order.receiptJws!, TOKEN_TYPE.receipt);
    expect(receipt.valid).toBe(true);
    expect(receipt.payload).toMatchObject({
      type: "order_receipt",
      orderId: order.id,
      offerId: order.offer.id,
      offerHash: await env.deps.hash(order.offer),
      status: "confirmed",
      responseCode: "AP",
      auditSeq: 3,
    });
    expect(env.audit.entries.map((e) => e.event)).toEqual(["order.requested", "policy.evaluated", "order.confirmed"]);
    expect(env.audit.entries[2].summary).toBe(
      "Harbour purchasing agent ordered 1,000 x Valio Eila 1 l for 1,010.00 EUR. Inside the mandate, no approval needed.",
    );
    expect(env.policy.calls[0]).toMatchObject({ agentId: AGENT.id, weekSpendNet: 0 });
  });

  it("returns the same order for a retry and rejects a reused key for another offer", async () => {
    const env = await setup();
    const body = { offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: KEY };
    const [first, second] = await Promise.all([placeOrder(body, env.deps, AGENT), placeOrder(body, env.deps, AGENT)]);
    const third = await placeOrder(body, env.deps, AGENT);
    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect((await env.store.orders.list())).toHaveLength(1);

    const other = await setup();
    await expect(placeOrder({ ...body, offerJws: other.offerJws }, env.deps, AGENT)).rejects.toBeInstanceOf(ConflictError);
  });

  it("never hands one agent's order to another agent that reuses its key", async () => {
    const env = await setup();
    const body = { offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: KEY };
    await placeOrder(body, env.deps, AGENT);
    await expect(placeOrder(body, env.deps, OTHER_AGENT)).rejects.toBeInstanceOf(ConflictError);
  });

  it("files an agent's order under its own buyer, even with another buyer's mandate, and blocks it", async () => {
    const env = await setup();
    const order = await placeOrder({ offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: KEY }, env.deps, OTHER_AGENT);
    expect(order.buyer).toEqual(OTHER_AGENT.buyer);
    expect(order.agent).toEqual({ id: OTHER_AGENT.id, name: OTHER_AGENT.name });
    expect(env.policy.calls[0].agentId).toBe(OTHER_AGENT.id);
    expect(env.audit.entries[0].refs.buyerId).toBe(OTHER_AGENT.buyer.id);
  });

  it("records a tampered offer as a blocked order", async () => {
    const env = await setup();
    const [header, payload, signature] = env.offerJws.split(".");
    const offer = JSON.parse(Buffer.from(payload, "base64url").toString());
    offer.totals.net.amount = 1;
    const forged = [header, Buffer.from(JSON.stringify(offer)).toString("base64url"), signature].join(".");

    const order = await placeOrder({ offerJws: forged, mandateJws: env.mandateJws, idempotencyKey: KEY }, env.deps, AGENT);
    expect(order.status).toBe("blocked");
    expect(order.receiptJws).toBeUndefined();
    expect(env.policy.calls[0].offer.valid).toBe(false);
    expect(env.audit.entries.at(-1)?.event).toBe("order.blocked");
  });

  it("records an order with an unreadable mandate as blocked by an unknown agent", async () => {
    const env = await setup();
    const order = await placeOrder({ offerJws: env.offerJws, mandateJws: "a.b.c", idempotencyKey: KEY }, env.deps);
    expect(order).toMatchObject({ status: "blocked", agent: { id: "unknown", name: "Unknown agent" }, mandateId: "unknown" });
  });

  it("refuses an offer that cannot be read at all", async () => {
    const env = await setup();
    await expect(
      placeOrder({ offerJws: "not-a-jws", mandateJws: env.mandateJws, idempotencyKey: KEY }, env.deps, AGENT),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("approvals", () => {
  async function pending() {
    const env = await setup("464306", 2000);
    const order = await placeOrder({ offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: KEY }, env.deps, AGENT);
    expect(order.status).toBe("pending_approval");
    return { env, order };
  }

  it("confirms an approved order with a signed approval and receipt", async () => {
    const { env, order } = await pending();
    expect(await pendingApprovals(BUYER.id, env.deps)).toHaveLength(1);
    expect(env.audit.entries.at(-1)?.event).toBe("approval.requested");

    const approved = await decideApproval(order.id, { decision: "approved", note: "Fine for the weekend." }, env.deps, DECIDER);
    expect(approved.status).toBe("confirmed");
    expect(approved.approval).toMatchObject({ decision: "approved", decidedBy: { name: "Maria Lind" } });
    const signed = await env.trust.verify<{ orderId: string; decision: string }>("approver", approved.approval!.jws, TOKEN_TYPE.approval);
    expect(signed.payload).toMatchObject({ orderId: order.id, decision: "approved" });
    expect((await env.trust.verify("supplier", approved.receiptJws!, TOKEN_TYPE.receipt)).valid).toBe(true);
    expect(env.audit.entries.slice(-2).map((e) => e.event)).toEqual(["approval.granted", "order.confirmed"]);
    expect(await pendingApprovals(BUYER.id, env.deps)).toHaveLength(0);
    await expect(decideApproval(order.id, { decision: "approved" }, env.deps, DECIDER)).rejects.toBeInstanceOf(StateError);
  });

  it("rejects an order", async () => {
    const { env, order } = await pending();
    const rejected = await decideApproval(order.id, { decision: "rejected", note: "Too much." }, env.deps, DECIDER);
    expect(rejected.status).toBe("rejected");
    expect(rejected.receiptJws).toBeUndefined();
    expect((await getOrder(order.id, env.deps)).status).toBe("rejected");
    expect(env.audit.entries.at(-1)?.event).toBe("approval.rejected");
  });

  it("rejects an order whose offer expired while waiting", async () => {
    const { env, order } = await pending();
    env.clock.current = new Date(Date.parse(order.offer.expiresAt) + 1000);
    const decided = await decideApproval(order.id, { decision: "approved" }, env.deps, DECIDER);
    expect(decided.status).toBe("rejected");
    expect(decided.decision).toEqual(order.decision);
    expect(env.audit.entries.at(-1)?.data).toMatchObject({ reason: "offer_expired" });
  });

  it("reports unknown orders", async () => {
    const env = await setup();
    await expect(decideApproval("ord_missing", { decision: "approved" }, env.deps, DECIDER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides an order from another buyer's approver", async () => {
    const { env, order } = await pending();
    await expect(decideApproval(order.id, { decision: "approved" }, env.deps, { buyerId: "buyer:kaisla" })).rejects.toBeInstanceOf(NotFoundError);
    expect(await pendingApprovals("buyer:kaisla", env.deps)).toHaveLength(0);
    expect((await getOrder(order.id, env.deps)).status).toBe("pending_approval");
  });

  it("says in the audit entry when the decision came through demo access", async () => {
    const { env, order } = await pending();
    await decideApproval(order.id, { decision: "rejected" }, env.deps, { ...DECIDER, via: "demo access" });
    expect(env.audit.entries.at(-1)?.data).toMatchObject({ via: "demo access" });
  });
});
