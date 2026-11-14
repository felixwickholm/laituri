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
  return { line, product: p, ...(substituteFor ? { replaced: product(substituteFor) } : {}) };
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

  it("checks a substitute's brand and attributes against the product that would be delivered, and names it", () => {
    // The buyer names Arla UHT milk; the substitute is Valio Eila 1 l, another brand and not UHT.
    const checks = checkRequest(readBuyerWords("100 l Arla lactose-free UHT milk by Monday", NOW), OFFER, [offered("464306", 100, 100, "464401")]);
    const brand = checks.find((c) => c.requirement === "brand");
    const attribute = checks.find((c) => c.requirement === "attribute");
    expect(brand).toMatchObject({ result: "substituted", asked: '"arla"', certain: false });
    expect(brand?.offered).toMatch(/Valio Eila 1 l/);
    expect(attribute).toMatchObject({ result: "unmet", asked: "UHT", certain: false });
    expect(attribute?.offered).toMatch(/Valio Eila 1 l/);
    expect(checks.filter((c) => c.requirement === "wording")).toEqual([]);
  });

  it("meets brand and attribute words that the delivered product itself carries", () => {
    const checks = results("100 l Valio UHT milk by Monday", [offered("462775", 100)]);
    expect(checks).toContainEqual(["brand", "met", false]);
    expect(checks).toContainEqual(["attribute", "met", false]);
  });

  it("does not meet a brand the agent swapped itself, outside any substitute line", () => {
    expect(results("100 l Arla milk by Monday", [offered("464306", 100)])).toContainEqual(["wording", "unchecked", false]);
    expect(results("100 l Arla milk by Monday", [offered("464401", 50), offered("464306", 50)])).toContainEqual(["brand", "unmet", false]);
  });

  it("holds a stated fat level against the delivered product", () => {
    expect(results("100 l skimmed milk by Monday", [offered("462775", 100)])).toContainEqual(["attribute", "met", false]);
    expect(results("100 l whole milk by Monday", [offered("462775", 100)])).toContainEqual(["attribute", "unmet", false]);
  });

  it("marks a product code that a substitute replaces as substituted", () => {
    expect(results("100 l of product 464401 by Monday", [offered("464306", 100, 100, "464401")])).toContainEqual(["product", "substituted", false]);
  });

  it("reads 'not lactose-free' as a claim the product must not carry", () => {
    const words = "100 litres of milk by Monday, not lactose-free";
    expect(results(words, [offered("464306", 100)])).toContainEqual(["claim", "unmet", true]);
    expect(results(words, [offered("464398", 100)])).toContainEqual(["claim", "met", false]);
    expect(results("100 litraa maitoa maanantaiksi, ei laktoositonta", [offered("464306", 100)])).toContainEqual(["claim", "unmet", true]);
    expect(results("100 liter mjölk till måndag, inte laktosfri", [offered("464306", 100)])).toContainEqual(["claim", "unmet", true]);
  });

  it("holds an exclusion in a purpose clause against the delivered product", () => {
    const checks = checkRequest(readBuyerWords("200 litres of milk by Monday for a dairy-free breakfast", NOW), OFFER, [offered("464306", 200)]);
    expect(checks).toContainEqual(expect.objectContaining({ requirement: "claim", asked: "dairy-free", result: "unmet", certain: true }));
    expect(results("200 l milk by Monday for a nut-free kitchen", [offered("464306", 200)])).toContainEqual(["claim", "met", false]);
    expect(results("200 l milk by Monday for a nut-free kitchen", [offered("464073", 200)])).toContainEqual(["claim", "unmet", true]);
  });

  it("leaves a clause it does not understand unchecked, and a harmless one alone", () => {
    expect(results("200 l lactose-free milk by Monday. Put it next to the dishwasher.", [offered("464306", 200)])).toContainEqual(["wording", "unchecked", false]);
    const brief = "I need 1,000 litres of lactose-free milk by Monday. Find an option that meets our requirements based on price and availability.";
    expect(results(brief, [offered("464306", 1000)]).every(([, result]) => result === "met")).toBe(true);
    expect(results("200 l lactose-free milk by Monday for breakfast", [offered("464306", 200)]).every(([, result]) => result === "met")).toBe(true);
  });

  it("does not read the word tying a date to the request as not understood", () => {
    const checks = results("80 l lactose-free milk by Monday under 50 euros", [offered("464306", 80)]);
    expect(checks.filter(([requirement]) => requirement === "wording")).toEqual([]);
  });

  it("holds a zero budget like any other", () => {
    expect(results("200 l lactose-free milk by Monday, budget 0 euros", [offered("464306", 200)])).toContainEqual(["budget", "unmet", false]);
  });

  it("reads every instruction to hold as an order to wait", () => {
    for (const words of [
      "200 litres of lactose-free milk by Monday for breakfast; do not order yet",
      "200 l lactose-free milk by Monday, don't order",
      "200 l lactose-free milk by Monday. Hold it.",
      "200 l lactose-free milk by Monday, wait",
      "200 litraa laktoositonta maitoa maanantaiksi, älä vielä tilaa",
      "200 litraa laktoositonta maitoa maanantaiksi, odota",
      "200 liter laktosfri mjölk till måndag, beställ inte än",
      "200 liter laktosfri mjölk till måndag, vänta",
    ]) {
      expect(results(words, [offered("464306", 200)]), words).toContainEqual(["approval", "unmet", false]);
    }
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
