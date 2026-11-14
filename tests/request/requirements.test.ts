import { describe, expect, it } from "vitest";
import type { OfferLine, Product, RequestCheck } from "@/lib/contracts";
import { checkRequest, describeCheck, readBuyerWords, type OfferedLine } from "@/lib/request";
import { PRODUCTS } from "../support/products";

const NOW = new Date("2026-11-14T09:00:00+02:00");
const product = (id: string): Product => PRODUCTS.find((p) => p.id === id)!;

function offered(id: string, quantity: number, requested = quantity, substituteFor?: string): OfferedLine {
  const p = product(id);
  const line: OfferLine = {
    productId: id,
    name: p.name.en,
    categoryGroup: "dairy",
    quantity,
    salesUnit: "ST",
    content: quantity > 0 ? { amount: quantity, unit: "l" } : undefined,
    unitPrice: { amount: 1, currency: "EUR" },
    taxRate: 13.5,
    lineNet: { amount: quantity, currency: "EUR" },
    availability: { status: quantity < requested ? "partial" : "available", requested, available: quantity, deliveryDate: "2026-11-16" },
    ...(substituteFor
      ? { substituteFor: { productId: substituteFor, name: product(substituteFor).name.en, reason: "short", likeForLike: true, priceChangePct: 0 } }
      : {}),
  };
  return { line, product: p, named: substituteFor ? product(substituteFor) : p };
}

const OFFER = { deliveryDate: "2026-11-16", totals: { net: { amount: 100, currency: "EUR" as const }, tax: { amount: 13.5, currency: "EUR" as const }, gross: { amount: 113.5, currency: "EUR" as const } } };

function results(words: string, lines: OfferedLine[], offer = OFFER): [string, string, boolean][] {
  return checkRequest(readBuyerWords(words, NOW), offer, lines).map((c: RequestCheck) => [c.requirement, c.result, c.certain]);
}

describe("request checks", () => {
  it("meets a plain request in every respect", () => {
    expect(results("100 l lactose-free milk by Monday", [offered("464306", 100)])).toEqual([
      ["product", "met", false],
      ["claim", "met", false],
      ["quantity", "met", false],
      ["date", "met", false],
    ]);
  });

  it("refuses a missing claim and far too little as certain", () => {
    const checks = results("1,000 l lactose-free milk by Monday", [offered("464398", 1)]);
    expect(checks).toContainEqual(["claim", "unmet", true]);
    expect(checks).toContainEqual(["quantity", "unmet", true]);
  });

  it("sends a stock shortfall to a person rather than refusing it", () => {
    expect(results("100 l lactose-free milk", [offered("462775", 51, 100)])).toContainEqual(["quantity", "unmet", false]);
  });

  it("allows one lot over the need and no more", () => {
    expect(results("100 l lactose-free milk", [offered("464306", 101)])).toContainEqual(["quantity", "met", false]);
    expect(results("100 l lactose-free milk", [offered("464306", 102)])).toContainEqual(["quantity", "unmet", false]);
  });

  it("judges a substitute by the product it replaces for the brand words, and by itself for the claims", () => {
    const checks = results("100 l Arla lactose-free milk", [offered("464306", 100, 100, "464401")]);
    expect(checks).toContainEqual(["wording", "met", false]);
    expect(checks).toContainEqual(["claim", "met", false]);
  });

  it("holds the budget against the total with VAT and the date against the delivery", () => {
    expect(results("100 l lactose-free milk by Monday, max 100 €", [offered("464306", 100)])).toContainEqual(["budget", "unmet", false]);
    expect(results("100 l lactose-free milk by Sunday", [offered("464306", 100)])).toContainEqual(["date", "unmet", false]);
  });

  it("names the requirement in one sentence", () => {
    const [budget] = checkRequest(readBuyerWords("max 100 €", NOW), OFFER, [offered("464306", 100)]).filter((c) => c.requirement === "budget");
    expect(describeCheck(budget)).toBe("Budget: asked at most €100.00, offered €113.50 with VAT");
  });
});
