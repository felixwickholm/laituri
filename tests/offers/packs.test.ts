import { describe, expect, it } from "vitest";
import { contentPerUnit, requiredContent, unitsFor } from "@/lib/offers/packs";
import { PRICES, PRODUCTS } from "../support/products";

describe("pack maths", () => {
  it("converts 1,000 l into 1,000 one-litre units", () => {
    expect(unitsFor({ amount: 1000, unit: "l" }, { amount: 1, unit: "l" }, 1)).toBe(1000);
  });

  it("converts 1,000 l into 200 cases of 5 x 1 l", () => {
    expect(unitsFor({ amount: 1000, unit: "l" }, { amount: 5, unit: "l" }, 1)).toBe(200);
  });

  it("rounds up to the lot size", () => {
    expect(unitsFor({ amount: 1001, unit: "l" }, { amount: 5, unit: "l" }, 1)).toBe(201);
    expect(unitsFor({ amount: 10, unit: "l" }, { amount: 1, unit: "l" }, 6)).toBe(12);
  });

  it("converts kilograms", () => {
    expect(unitsFor({ amount: 3, unit: "kg" }, { amount: 0.5, unit: "kg" }, 4)).toBe(8);
    expect(unitsFor({ amount: 1.2, unit: "kg" }, { amount: 0.2, unit: "kg" }, 1)).toBe(6);
  });

  it("uses sales units as given and refuses unknown or mismatched content", () => {
    expect(unitsFor({ amount: 7, unit: "sales_unit" }, undefined, 6)).toBe(7);
    expect(unitsFor({ amount: 5, unit: "kg" }, { amount: 1, unit: "l" }, 1)).toBeUndefined();
    expect(unitsFor({ amount: 5, unit: "l" }, undefined, 1)).toBeUndefined();
  });

  it("derives content from catalogue and comparison price when product data lacks it", () => {
    const product = { ...PRODUCTS[4], content: undefined };
    expect(contentPerUnit(product, PRICES[4])).toEqual({ amount: 5, unit: "l" });
    expect(requiredContent({ amount: 3, unit: "sales_unit" }, { amount: 5, unit: "l" })).toEqual({ amount: 15, unit: "l" });
  });
});
