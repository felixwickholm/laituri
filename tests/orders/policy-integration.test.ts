import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placeOrder } from "@/lib/orders";
import { evaluate } from "@/lib/policy/evaluate";
import { AGENT } from "../support/deps";
import { NOW } from "../support/products";
import { setup } from "./helpers";

describe("placeOrder with the real policy", () => {
  beforeAll(() => {
    process.env.LAITURI_NOW = NOW;
  });
  afterAll(() => {
    delete process.env.LAITURI_NOW;
  });

  it("auto-approves an order inside the mandate and lists all 15 checks", async () => {
    const env = await setup();
    env.deps.policy = { evaluate };
    const order = await placeOrder({ offerJws: env.offerJws, mandateJws: env.mandateJws, idempotencyKey: "real-policy-1" }, env.deps, AGENT);
    expect(order.decision.checks).toHaveLength(15);
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
    const place = (key: string) => placeOrder({ offerJws: env.offerJws, mandateJws, idempotencyKey: key }, env.deps, AGENT);

    const orders = await Promise.all([place("same-time-1"), place("same-time-2"), place("same-time-3")]);

    expect(orders.map((o) => o.status).sort()).toEqual(["confirmed", "pending_approval", "pending_approval"]);
    const confirmed = orders.filter((o) => o.status === "confirmed").reduce((sum, o) => sum + o.offer.totals.net.amount, 0);
    expect(confirmed).toBeLessThanOrEqual(limits.perWeek.amount);
  });
});
