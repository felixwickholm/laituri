import "../store/temp-data-dir";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { QuoteRequest } from "@/lib/contracts";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_CATALOG = path.join(process.cwd(), "fixtures", "upstream", "catalog.json");

const { DEMO_AGENT } = await import("@/lib/agent");
const { gateway } = await import("@/lib/gateway");
const { createVolatileStore } = await import("@/lib/store/memory");
const { inWorkspace, newWorkspace } = await import("@/lib/workspace/context");

const MONDAY = "2026-11-16";
const milk = (litres: number): QuoteRequest => ({
  lines: [{ productId: "464306", quantity: { amount: litres, unit: "l" } }],
  deliverBy: MONDAY,
  intent: `${litres} litres of lactose-free milk by Monday`,
});

const sandbox = (id: string) => newWorkspace({ id, kind: "sandbox", label: `Sandbox ${id}`, store: createVolatileStore() });

let key = 0;
const nextKey = () => `binding-key-${++key}-${Date.now()}`;

beforeEach(async () => {
  await gateway().reset();
});

describe("a mandate counts only in the workspace that signed it", () => {
  it("refuses another workspace's permissive mandate with the same id and version", async () => {
    // Here the buyer excludes milk under version 2; elsewhere a version 2 raises the limits instead.
    await gateway().updateMandate({ dietary: { excludeAllergens: ["milk"], blockMayContain: false, requiredClaims: [] } });
    const foreign = await inWorkspace(sandbox("ws_foreign_mandate"), async () =>
      gateway().updateMandate({ limits: { perOrder: { amount: 9000, currency: "EUR" }, perWeek: { amount: 90000, currency: "EUR" } } }),
    );
    expect(foreign.mandate.version).toBe(2);

    const { primary } = await gateway().requestQuote(DEMO_AGENT, milk(100));
    const order = await gateway().placeOrder(DEMO_AGENT, { offerJws: primary.jws, mandateJws: foreign.jws, idempotencyKey: nextKey() });
    expect(order.status).toBe("blocked");
    expect(order.refusal).toEqual({ code: "not_issued_here", message: expect.stringMatching(/^Refused: the mandate/) });
    expect(order.decision.checks.find((check) => check.rule === "mandate.signature")?.status).toBe("block");
  });
});

describe("an offer counts only in the workspace that issued it, once", () => {
  it("refuses an offer signed in another workspace, and orders it once where it was issued", async () => {
    const elsewhere = sandbox("ws_issuer");
    const { primary } = await inWorkspace(elsewhere, () => gateway().requestQuote(DEMO_AGENT, milk(100)));

    const { jws: mandateJws } = await gateway().getMandate();
    const here = await gateway().placeOrder(DEMO_AGENT, { offerJws: primary.jws, mandateJws, idempotencyKey: nextKey() });
    expect(here).toMatchObject({ status: "blocked", refusal: { code: "not_issued_here", message: "Refused: the offer was not issued in this workspace." } });

    const third = sandbox("ws_third");
    const { jws: thirdMandate } = await inWorkspace(third, () => gateway().getMandate());
    const there = await inWorkspace(third, () => gateway().placeOrder(DEMO_AGENT, { offerJws: primary.jws, mandateJws: thirdMandate, idempotencyKey: nextKey() }));
    expect(there.refusal?.code).toBe("not_issued_here");

    const [first, second] = await inWorkspace(elsewhere, async () => {
      const { jws } = await gateway().getMandate();
      const one = await gateway().placeOrder(DEMO_AGENT, { offerJws: primary.jws, mandateJws: jws, idempotencyKey: nextKey() });
      const two = await gateway().placeOrder(DEMO_AGENT, { offerJws: primary.jws, mandateJws: jws, idempotencyKey: nextKey() });
      return [one, two];
    });
    expect(first.status).toBe("confirmed");
    expect(second.status).toBe("blocked");
    expect(second.refusal).toBeUndefined();
  });

  it("refuses an offer whose signature does not verify with its own reason, apart from mandate blocks", async () => {
    const { primary } = await gateway().requestQuote(DEMO_AGENT, milk(100));
    const [header, payload, signature] = primary.jws.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    claims.totals.net.amount = 1;
    const forged = `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;
    const { jws: mandateJws } = await gateway().getMandate();
    const order = await gateway().placeOrder(DEMO_AGENT, { offerJws: forged, mandateJws, idempotencyKey: nextKey() });
    expect(order.refusal).toEqual({ code: "invalid_signature", message: "Refused: the offer's signature did not verify." });
    const overview = await gateway().supplierOverview();
    expect(overview.orders.byOutcome.refused.count).toBe(1);
    expect(overview.orders.byOutcome.blocked.count).toBe(0);
  });
});
