import "../store/temp-data-dir";
import { describe, expect, it } from "vitest";
import type { PurchaseResult } from "@/lib/agent";
import { createGateway } from "@/lib/gateway";
import { spokenSummary } from "@/lib/voice";
import { AGENT, makeDeps, testMandate } from "../support/deps";

async function orderFor(litres: number) {
  const gateway = createGateway(makeDeps().deps);
  const quote = await gateway.requestQuote(AGENT, {
    lines: [{ productId: "464306", quantity: { amount: litres, unit: "l" } }],
    deliverBy: "2026-11-16",
  });
  const { jws: mandateJws } = await gateway.getMandate();
  return gateway.placeOrder(AGENT, { offerJws: quote.primary.jws, mandateJws, idempotencyKey: `voice-test-${litres}` });
}

const result = (status: PurchaseResult["status"], summary = ""): PurchaseResult => ({ status, summary, steps: [] });

describe("spokenSummary", () => {
  it("says what arrives, when and for how much", async () => {
    const order = await orderFor(100);
    expect(spokenSummary(result("confirmed"), { order, mandate: testMandate() })).toBe(
      "Done. 100 litres of Valio Eila arrive Monday for 101 euros. It was inside your mandate.",
    );
  });

  it("says how far an order is over the per-order limit", async () => {
    const order = await orderFor(2000);
    expect(spokenSummary(result("waiting"), { order, mandate: testMandate() })).toBe(
      "This one needs you: it is 520 euros over your per-order limit.",
    );
  });

  it("stays general without the order", () => {
    expect(spokenSummary(result("confirmed"))).toBe("Done. The order is confirmed and it was inside your mandate.");
    expect(spokenSummary(result("waiting"))).toBe("This one needs you: the order waits for your approval.");
    expect(spokenSummary(result("blocked"))).toBe("Nothing was ordered. The order is outside your mandate.");
    expect(spokenSummary(result("failed"))).toBe("Something went wrong, so nothing was ordered.");
  });

  it("reads the agent's own question when it needs input", () => {
    const question = "I need a quantity. How much milk do you need?";
    expect(spokenSummary(result("needs_input", question))).toBe(question);
  });
});
