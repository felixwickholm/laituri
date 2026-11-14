import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RuleId, type QuoteRequest } from "@/lib/contracts";
import { quote } from "@/lib/offers";
import { placeOrder } from "@/lib/orders";
import { evaluate } from "@/lib/policy/evaluate";
import { AGENT, QUOTE_CONTEXT } from "../support/deps";
import { DELIVER_BY, NOW } from "../support/products";
import { setup } from "./helpers";

describe("placeOrder with the real policy", () => {
  beforeAll(() => {
    process.env.LAITURI_NOW = NOW;
  });
  afterAll(() => {
    delete process.env.LAITURI_NOW;
  });

  it("auto-approves an order inside the mandate and lists every check", async () => {
    const env = await setup();
    env.deps.policy = { evaluate };
    const order = await placeOrder({ offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: "real-policy-1" }, env.deps, AGENT);
    expect(order.decision.checks).toHaveLength(RuleId.options.length);
    expect(order.decision.checks.filter((c) => c.status !== "pass")).toEqual([]);
    expect(order.status).toBe("confirmed");
  });

  it("blocks an offer whose cut-off passed", async () => {
    const env = await setup("465039");
    env.deps.policy = { evaluate };
    const order = await placeOrder({ offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: "real-policy-2" }, env.deps, AGENT);
    expect(order.status).toBe("blocked");
    expect(order.decision.checks.find((c) => c.rule === "offer.expiry")?.status).toBe("block");
  });

  it("does not let two orders sent at the same time pass a weekly limit that fits only one", async () => {
    const env = await setup();
    env.deps.policy = { evaluate };
    const total = env.quoted.primary.offer.totals.net.amount;
    const limits = { perOrder: { amount: total * 2, currency: "EUR" as const }, perWeek: { amount: total * 1.5, currency: "EUR" as const } };
    const { jws: mandateJws } = await env.deps.mandates.update({ limits });
    const request: QuoteRequest = {
      lines: [{ productId: "464306", quantity: { amount: 1000, unit: "l" } }],
      deliverBy: DELIVER_BY,
      intent: "1,000 litres of product 464306 by Monday",
    };
    const offers = await Promise.all([1, 2, 3].map(() => quote(request, QUOTE_CONTEXT, env.deps)));
    const place = (offerJws: string, key: string) => placeOrder({ offerJws, mandateJws, idempotencyKey: key }, env.deps, AGENT);

    const orders = await Promise.all(offers.map((o, i) => place(o.primary.jws, `same-time-${i}`)));

    expect(orders.map((o) => o.status).sort()).toEqual(["confirmed", "pending_approval", "pending_approval"]);
    const confirmed = orders.filter((o) => o.status === "confirmed").reduce((sum, o) => sum + o.offer.totals.net.amount, 0);
    expect(confirmed).toBeLessThanOrEqual(limits.perWeek.amount);
  });

  it("takes one order per signed offer", async () => {
    const env = await setup();
    env.deps.policy = { evaluate };
    const place = (key: string) => placeOrder({ offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: key }, env.deps, AGENT);
    const first = await place("once-1");
    const second = await place("once-2");
    expect([first.status, second.status]).toEqual(["confirmed", "blocked"]);
    expect(second.decision.checks.find((c) => c.rule === "offer.signature")?.status).toBe("block");
  });

  it("refuses a mandate that the buyer has since replaced", async () => {
    const env = await setup();
    env.deps.policy = { evaluate };
    await env.deps.mandates.update({ limits: { perOrder: { amount: 10, currency: "EUR" } } });
    const order = await placeOrder({ offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: "old-mandate" }, env.deps, AGENT);
    expect(order.status).toBe("blocked");
  });
});
