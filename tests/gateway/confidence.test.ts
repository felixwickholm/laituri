import { describe, expect, it } from "vitest";
import type { QuoteRequest } from "@/lib/contracts";
import { catalog as loadCatalog } from "@/lib/catalog";
import { matchConfidence } from "@/lib/gateway/confidence";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_CATALOG = "fixtures/upstream/catalog.json";
process.env.LAITURI_NOW = "2026-11-14T09:00:00+02:00";
const catalog = loadCatalog();
const quoteFor = (productId: string, extra: Partial<QuoteRequest>): QuoteRequest => ({
  lines: [{ productId, quantity: { amount: 100, unit: "l" } }],
  deliverBy: "2026-11-16",
  ...extra,
});

describe("matchConfidence", () => {
  it("confirms a clear request for the quoted product", () => {
    const request = quoteFor("464306", { intent: "1,000 litres of lactose-free milk by Monday", matchConfidence: "high" });
    expect(matchConfidence(request, catalog)).toBe("high");
  });

  it("does not report more than the agent claims", () => {
    const request = quoteFor("464306", { intent: "lactose-free milk", matchConfidence: "low" });
    expect(matchConfidence(request, catalog)).toBe("low");
  });

  it("is low when the quoted product is not what the buyer asked for", () => {
    const request = quoteFor("464306", { intent: "50 kg butter by Monday", matchConfidence: "high" });
    expect(matchConfidence(request, catalog)).toBe("low");
  });

  it("is at most medium without the buyer's words", () => {
    expect(matchConfidence(quoteFor("464306", {}), catalog)).toBe("medium");
  });
});
