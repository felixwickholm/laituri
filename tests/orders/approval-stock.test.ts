import { describe, expect, it } from "vitest";
import { createGateway } from "@/lib/gateway/gateway";
import { approvalResponse } from "@/lib/http/order-response";
import { stockWasTaken } from "@/lib/orders/stock";
import { evaluate } from "@/lib/policy/evaluate";
import { AGENT, BUYER, makeDeps } from "../support/deps";
import { DELIVER_BY } from "../support/products";

/** 462775 has 51 counted units in the fake wholesaler. */
async function waitingOrder() {
  const env = makeDeps();
  env.deps.policy = { evaluate };
  const gateway = createGateway(env.deps);
  await gateway.updateMandate({ limits: { perOrder: { amount: 1, currency: "EUR" }, perWeek: { amount: 5000, currency: "EUR" } } });
  const { primary } = await gateway.requestQuote(AGENT, {
    lines: [{ productId: "462775", quantity: { amount: 40, unit: "sales_unit" } }],
    deliverBy: DELIVER_BY,
    intent: "40 units of product 462775 by Monday",
  });
  const { jws: mandateJws } = await gateway.getMandate();
  const order = await gateway.placeOrder(AGENT, { offerJws: primary.jws, mandateJws, idempotencyKey: "approval-stock-1" });
  expect(order.status).toBe("pending_approval");
  return { ...env, gateway, order };
}

describe("stock at approval", () => {
  it("asks the wholesaler again and blocks the approval when its count fell below the order", async () => {
    const { gateway, upstream, order } = await waitingOrder();
    upstream.stock.set("462775", { ...upstream.stock.get("462775")!, available: 30 });

    const decided = await gateway.decideApproval(order.id, { decision: "approved" }, { buyerId: BUYER.id });
    expect(decided.status).toBe("blocked");
    expect(decided.receiptJws).toBeUndefined();
    expect(stockWasTaken(decided)).toBe(true);
    expect(decided.decision.checks.find((check) => check.rule === "offer.expiry")?.message).toMatch(/Only 30 units/);

    const fresh = await gateway.requote(decided);
    expect(fresh.primary.offer.lines[0].availability).toMatchObject({ available: 30, requested: 40 });
  });

  it("answers a stopped approval with 409, the blocked order and the fresh alternatives", async () => {
    const { gateway, upstream, order } = await waitingOrder();
    upstream.stock.set("462775", { ...upstream.stock.get("462775")!, available: 30 });
    const decided = await gateway.decideApproval(order.id, { decision: "approved" }, { buyerId: BUYER.id });
    const { alternatives } = await gateway.requote(decided);

    const response = approvalResponse(decided, alternatives);
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = await response.json();
    expect(body).toMatchObject({ code: "approval_blocked", status: 409, order: { id: order.id, status: "blocked" } });
    expect(body.alternatives).toHaveLength(alternatives.length);
    expect(body.detail).toMatch(/^The approval was stopped: Only 30 units/);
  });

  it("answers a decided order with 200", async () => {
    const { gateway, order } = await waitingOrder();
    const decided = await gateway.decideApproval(order.id, { decision: "approved" }, { buyerId: BUYER.id });
    expect(decided.status).toBe("confirmed");
    expect(approvalResponse(decided, []).status).toBe(200);
  });
});
