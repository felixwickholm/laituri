import "../store/temp-data-dir";
import { describe, expect, it } from "vitest";
import { runPurchase, TransportError, type AgentTransport } from "@/lib/agent";
import { quoteRefusal } from "@/lib/agent/refusal";
import { createGateway } from "@/lib/gateway";
import { ImplausibleQuantityError, PastDeliveryDateError } from "@/lib/offers/limits";
import { AGENT, makeDeps } from "../support/deps";

const MONDAY = "2026-11-16";
const hooks = { note: () => undefined, pause: async () => undefined };

function gatewayTransport(): AgentTransport {
  const gateway = createGateway(makeDeps().deps);
  return {
    searchCatalog: (request) => gateway.searchCatalog(AGENT, request),
    getProduct: (id) => gateway.getProduct(AGENT, id),
    requestQuote: (request) => gateway.requestQuote(AGENT, request),
    getMandate: () => gateway.getMandate(),
    placeOrder: (request) => gateway.placeOrder(AGENT, request),
    getOrder: (id) => gateway.getOrder(AGENT, id),
  };
}

describe("quoteRefusal", () => {
  it("turns a refused quantity into the buyer's sentence, from the gateway or over REST", () => {
    const request = { quantity: { amount: 1e12, unit: "l" as const }, deliverBy: MONDAY };
    const sentence = "Valio Aimo refused the quote: 1,000,000,000,000 litres is more than one order line can carry.";
    expect(quoteRefusal(new ImplausibleQuantityError("too much"), request)).toBe(sentence);
    expect(quoteRefusal(new TransportError("too much", 422, "quantity_implausible"), request)).toBe(sentence);
  });

  it("names a delivery date that has passed", () => {
    expect(quoteRefusal(new PastDeliveryDateError("past"), { deliverBy: "2026-11-09" })).toBe(
      "Valio Aimo refused the quote: Mon 9 Nov has already passed. Ask for today or a later date.",
    );
  });

  it("leaves every other error alone", () => {
    expect(quoteRefusal(new TransportError("down", 502, "upstream_unavailable"), { deliverBy: MONDAY })).toBeUndefined();
    expect(quoteRefusal(new Error("boom"), { deliverBy: MONDAY })).toBeUndefined();
    expect(quoteRefusal("boom", { deliverBy: MONDAY })).toBeUndefined();
  });
});

describe("runPurchase with a refused quote", () => {
  it("ends the run with the refusal in plain words, not as a failure", async () => {
    const result = await runPurchase("1000000000000 l lactose-free milk by Monday", gatewayTransport(), hooks);
    expect(result.status).toBe("needs_input");
    expect(result.summary).toBe(
      "Valio Aimo refused the quote: 1,000,000,000,000 litres is more than one order line can carry. No order placed.",
    );
    expect(result.steps.at(-1)).toEqual({ text: result.summary, status: "blocked" });
    expect(result.orderId).toBeUndefined();
  });
});
