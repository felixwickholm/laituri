import { describe, expect, it } from "vitest";
import {
  allergenSentences,
  availabilityText,
  co2Text,
  comparisonText,
  countryName,
  deliveryText,
  labelChips,
  packLabel,
  reliabilityText,
  unitPriceText,
} from "@/lib/shop-console/format";

const money = (amount: number) => ({ amount, currency: "EUR" as const });

describe("pack and price", () => {
  it("says what one sales unit holds", () => {
    expect(packLabel({ salesUnit: "ST", units: [{ unit: "ST", sizeInBaseUnits: 1 }], content: { amount: 1, unit: "l" } })).toBe("1 l");
    expect(packLabel({ salesUnit: "KI", units: [{ unit: "KI", sizeInBaseUnits: 12 }], content: { amount: 12, unit: "l" } })).toBe("12 × 1 l");
    expect(packLabel({ salesUnit: "KG", units: [], content: { amount: 1, unit: "kg" } })).toBe("Sold by the kilo");
    expect(packLabel({ salesUnit: "KI", units: [{ unit: "KI", sizeInBaseUnits: 6 }] })).toBe("6 pieces");
  });

  it("prices per sales unit and per litre or kilo", () => {
    expect(unitPriceText({ unitPrice: money(12.4) }, "KI")).toBe("€12.40 per case");
    expect(unitPriceText({ unitPrice: money(1) }, "ST")).toBe("€1.00 each");
    expect(comparisonText({ comparisonPrice: { amount: 1.03, per: "l" } })).toBe("€1.03 / l");
    expect(comparisonText({})).toBeUndefined();
  });
});

describe("stock and delivery", () => {
  const availability = (status: "available" | "partial" | "unavailable" | "cutoff_passed" | "blocked", available?: number) => ({
    availability: { status, ...(available === undefined ? {} : { available }) },
  });

  it("says stock in a word or two, honestly when it is not counted", () => {
    expect(availabilityText(availability("available", 500))).toEqual({ word: "In stock", tone: "success" });
    expect(availabilityText(availability("available", 51))).toEqual({ word: "51 left", tone: "waiting" });
    expect(availabilityText(availability("partial", 3))).toEqual({ word: "3 left", tone: "waiting" });
    expect(availabilityText(availability("available"))).toEqual({ word: "Stock not counted", tone: "neutral" });
    expect(availabilityText(availability("unavailable"))).toEqual({ word: "Out of stock", tone: "danger" });
    expect(availabilityText(undefined)).toEqual({ word: "No live price", tone: "neutral" });
  });

  it("gives the delivery day and the cut-off in Helsinki time", () => {
    expect(
      deliveryText({ availability: { status: "available", deliveryDate: "2026-11-16", orderBy: "2026-11-15T17:00:00+02:00" } }),
    ).toBe("Arrives Mon 16 Nov. Order by Sun 17:00.");
    expect(deliveryText({ availability: { status: "available" } })).toBeUndefined();
  });
});

describe("what Valio Aimo vouches for", () => {
  it("names labels and claims in plain words, once each", () => {
    expect(labelChips({ claims: ["lactose_free", "low_salt"], labels: ["finnish_origin"] }, { labels: ["finnish_origin", "organic"] })).toEqual([
      "Finnish origin",
      "Organic",
      "Lactose-free",
    ]);
  });

  it("states reliability, carbon and origin in words", () => {
    expect(reliabilityText(0.972)).toBe("97% of deliveries arrived in full and on time.");
    expect(reliabilityText(undefined)).toBeUndefined();
    expect(co2Text(1.1)).toBe("1.1 kg CO₂e per kg");
    expect(countryName("FI")).toBe("Finland");
    expect(countryName(undefined)).toBeUndefined();
  });

  it("says when there is no allergen data at all", () => {
    expect(allergenSentences({ contains: [], mayContain: [], freeFrom: [] })).toEqual(["No allergen data."]);
    expect(allergenSentences({ contains: ["milk", "lactose"], mayContain: ["nuts"], freeFrom: [] })).toEqual([
      "Contains milk and lactose.",
      "May contain tree nuts.",
    ]);
    expect(allergenSentences({ contains: [], mayContain: [], freeFrom: ["gluten"] })).toEqual(["No listed allergens."]);
  });
});
