import { describe, expect, it } from "vitest";
import { quoteNote } from "@/lib/agent/llm/tools";
import { line, offer } from "../policy/fixtures";

describe("the model-driven agent's quote step", () => {
  it("prints the price of an offer that delivers something", () => {
    expect(quoteNote(offer())).toMatch(/^Offer signed by Valio Aimo: .*, €101\.00 with VAT\.$/);
  });

  it("prints no amount for an offer that delivers nothing", () => {
    const nothing = offer(
      { fulfilment: "unavailable", totals: { net: { amount: 0, currency: "EUR" }, tax: { amount: 0, currency: "EUR" }, gross: { amount: 0, currency: "EUR" } } },
      [line({ quantity: 0, availability: { status: "unavailable", requested: 20, stock: "tracked", available: 0 } })],
    );
    expect(quoteNote(nothing)).toBe("Valio Aimo could not offer Valio Arki lactose-free milk drink 1 l.");
    expect(quoteNote(nothing)).not.toMatch(/€/);
  });
});
