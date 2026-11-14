import "../store/temp-data-dir";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Order, QuoteRequest } from "@/lib/contracts";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_CATALOG = path.join(process.cwd(), "fixtures", "upstream", "catalog.json");

const { DEMO_AGENT } = await import("@/lib/agent");
const { withClock } = await import("@/lib/clock");
const { tamperAudit, restoreAudit } = await import("@/lib/demo");
const { gateway } = await import("@/lib/gateway");
const { TOKEN_TYPE, trust } = await import("@/lib/trust");

const MONDAY = "2026-11-16";
/** Arla lactose-free fat-free milk drink: 51 units counted in the recording, cut-off Sunday 17:00 for Monday. */
const ARLA = "462775";
const HOUR_MS = 3_600_000;

const units = (count: number, productId = ARLA): QuoteRequest => ({
  lines: [{ productId, quantity: { amount: count, unit: "sales_unit" } }],
  deliverBy: MONDAY,
  intent: `${count} units of product ${productId} by Monday`,
});

let key = 0;
async function order(offerJws: string): Promise<Order> {
  const { jws: mandateJws } = await gateway().getMandate();
  return gateway().placeOrder(DEMO_AGENT, { offerJws, mandateJws, idempotencyKey: `holds-${++key}-${Date.now()}` });
}

const at = (ms: number) => () => new Date(Date.parse(process.env.LAITURI_NOW!) + ms);

beforeEach(async () => {
  await gateway().reset();
});

describe("stock across orders", () => {
  it("does not confirm 3 x 30 units against 51 in stock: later quotes and orders see what earlier orders took", async () => {
    const first = (await gateway().requestQuote(DEMO_AGENT, units(30))).primary;
    const second = (await gateway().requestQuote(DEMO_AGENT, units(30))).primary;
    expect((await order(first.jws)).status).toBe("confirmed");

    const late = await order(second.jws);
    expect(late.status).toBe("blocked");
    expect(late.decision.checks.find((check) => check.rule === "offer.expiry")?.message).toMatch(/Only 21 units .* are left/);

    const third = await gateway().requestQuote(DEMO_AGENT, units(30));
    expect(third.primary.offer.lines[0].availability).toMatchObject({ status: "partial", available: 21, reserved: 30, stock: "tracked" });
    expect(third.primary.offer.notes.join(" ")).toMatch(/held by this workspace's other orders/);
  });
});

describe("a waiting order keeps its price until the order cut-off", () => {
  /** 1,600 litres is over the hotel's per-order limit, so it waits for the approver. */
  async function waiting(): Promise<Order> {
    const { primary } = await gateway().requestQuote(DEMO_AGENT, {
      lines: [{ productId: "464306", quantity: { amount: 1600, unit: "l" } }],
      deliverBy: MONDAY,
      intent: "1,600 litres of lactose-free milk by Monday",
    });
    const placed = await order(primary.jws);
    expect(placed.status).toBe("pending_approval");
    return placed;
  }

  it("signs and logs a price hold until the cut-off, never past it", async () => {
    const placed = await waiting();
    expect(placed.priceHold?.heldUntil).toBe(placed.offer.orderBy);
    expect(Date.parse(placed.priceHold!.heldUntil)).toBeGreaterThan(Date.parse(placed.offer.expiresAt));
    const hold = await trust().verify<{ orderId: string; heldUntil: string }>("supplier", placed.priceHold!.jws, TOKEN_TYPE.priceHold);
    expect(hold.payload).toMatchObject({ orderId: placed.id, heldUntil: placed.offer.orderBy });
    const entries = await gateway().auditLog();
    expect(entries.at(-1)?.summary).toMatch(/holds the price until/);
  });

  it("lets the approver confirm two hours later, and rejects once the cut-off has passed", async () => {
    const first = await waiting();
    const approved = await withClock(at(2 * HOUR_MS), () => gateway().decideApproval(first.id, { decision: "approved" }));
    expect(approved.status).toBe("confirmed");

    const second = await waiting();
    const afterCutoff = Date.parse(second.offer.orderBy!) - Date.parse(process.env.LAITURI_NOW!) + HOUR_MS;
    const lapsed = await withClock(at(afterCutoff), () => gateway().decideApproval(second.id, { decision: "approved" }));
    expect(lapsed.status).toBe("rejected");
  });

  it("counts a waiting order's stock as held, so another order can take only what is left and both stand", async () => {
    await gateway().updateMandate({ approval: { firstTimeProducts: true } });
    const asked = (await gateway().requestQuote(DEMO_AGENT, units(40))).primary;
    const placed = await order(asked.jws);
    expect(placed.status).toBe("pending_approval");

    await gateway().updateMandate({ approval: { firstTimeProducts: false } });
    const other = (await gateway().requestQuote(DEMO_AGENT, units(11))).primary;
    expect(other.offer.lines[0].availability).toMatchObject({ available: 11, reserved: 40 });
    expect((await order(other.jws)).status).toBe("confirmed");

    // The other order took only what was left, so the waiting one still fits.
    expect((await gateway().decideApproval(placed.id, { decision: "approved" })).status).toBe("confirmed");
  });
});

describe("a broken audit log", () => {
  it("pauses automatic confirmation, naming why, until the log verifies again", async () => {
    await gateway().requestQuote(DEMO_AGENT, units(1, "464306"));
    await tamperAudit();
    const paused = await order((await gateway().requestQuote(DEMO_AGENT, units(10, "464306"))).primary.jws);
    expect(paused.status).toBe("pending_approval");
    expect(paused.decision.checks.find((check) => check.rule === "audit.integrity")).toMatchObject({
      status: "ask",
      message: expect.stringContaining("The audit log does not verify"),
    });

    await restoreAudit();
    const resumed = await order((await gateway().requestQuote(DEMO_AGENT, units(10, "464306"))).primary.jws);
    expect(resumed.status).toBe("confirmed");
  });
});
