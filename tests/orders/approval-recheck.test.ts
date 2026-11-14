import "../store/temp-data-dir";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Order } from "@/lib/contracts";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_CATALOG = path.join(process.cwd(), "fixtures", "upstream", "catalog.json");

const { DEMO_AGENT, gatewayTransport, runPurchase } = await import("@/lib/agent");
const { gateway } = await import("@/lib/gateway");
const { store } = await import("@/lib/store");

const QUIET = { note: () => undefined, pause: async () => undefined };

beforeEach(async () => {
  await gateway().reset();
});

/** 1,600 litres is over the hotel's per-order limit, so the order waits for the approver. */
async function pendingOrder(): Promise<Order> {
  const result = await runPurchase("1,600 litres of lactose-free milk by Monday", gatewayTransport(DEMO_AGENT), QUIET);
  const order = await gateway().getOrder(DEMO_AGENT, result.orderId!);
  expect(order.status).toBe("pending_approval");
  return order;
}

async function lastEntry() {
  const entries = await store().audit.list();
  return entries[entries.length - 1];
}

describe("approval re-checks the order against the mandate in force", () => {
  it("does not confirm a waiting order after the mandate came to exclude the milk allergen", async () => {
    const order = await pendingOrder();
    await gateway().updateMandate({ dietary: { excludeAllergens: ["milk"] } });

    const decided = await gateway().decideApproval(order.id, { decision: "approved" });
    expect(decided.status).toBe("blocked");
    expect(decided.receiptJws).toBeUndefined();
    expect(decided.decision.checks.find((check) => check.rule === "dietary.allergens")).toMatchObject({ status: "block" });

    const entry = await lastEntry();
    expect(entry).toMatchObject({ event: "order.blocked", refs: { orderId: order.id } });
    expect(entry.summary).toMatch(/contains milk/);
    expect(entry.signature).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect((await gateway().verifyAudit()).valid).toBe(true);
  });

  it("does not confirm a waiting order once the mandate has expired", async () => {
    const order = await pendingOrder();
    await gateway().updateMandate({ validUntil: "2026-11-13T00:00:00+02:00" });
    const decided = await gateway().decideApproval(order.id, { decision: "approved" });
    expect(decided.status).toBe("blocked");
    expect(decided.decision.checks.find((check) => check.rule === "mandate.validity")).toMatchObject({ status: "block" });
  });

  it("lets the approver decide what the ask tier left open, such as a category the mandate no longer lists", async () => {
    const order = await pendingOrder();
    await gateway().updateMandate({ categories: { allowed: ["bakery"] } });
    const decided = await gateway().decideApproval(order.id, { decision: "approved" });
    expect(decided.status).toBe("confirmed");
    expect(decided.receiptJws).toBeDefined();
  });

  it("still lets the approver reject without a re-check", async () => {
    const order = await pendingOrder();
    await gateway().updateMandate({ dietary: { excludeAllergens: ["milk"] } });
    const decided = await gateway().decideApproval(order.id, { decision: "rejected" });
    expect(decided.status).toBe("rejected");
  });
});
