import { describe, expect, it } from "vitest";
import type { OfferLine } from "@/lib/contracts";
import { offerSubject, offeredLine } from "@/lib/console/format/proof";
import { contentText, eachText, packContent, packCount, packText, priceUnit, stockText } from "@/lib/console/format/packs";
import { pendingOrder } from "./fixtures";

const NBSP = " ";

/** 10 kg of ciabatta rolls: a case holds 80 rolls of 58 g, 4.64 kg, so three cases cover it. */
const CIABATTA = { quantity: 3, salesUnit: "KI", content: { amount: 13.92, unit: "kg" as const } };
const MILK = { quantity: 1000, salesUnit: "ST", content: { amount: 1000, unit: "l" as const } };
const TOMATOES = { quantity: 12, salesUnit: "KG", content: { amount: 12, unit: "kg" as const } };

function availability(extra: Partial<OfferLine["availability"]>): Pick<OfferLine, "availability"> {
  return { availability: { status: "available", requested: 200, ...extra } };
}

describe("pack wording", () => {
  it("names cases as cases, so three cases of 58 g rolls never read as three rolls", () => {
    expect(packText(CIABATTA, "Dafgårds ciabatta 58g")).toBe(`3 cases of Dafgårds ciabatta 58g = 13.92${NBSP}kg`);
    expect(packCount(CIABATTA)).toBe("3 cases");
    expect(packContent(CIABATTA)).toBe(`3 × 4.64${NBSP}kg = 13.92${NBSP}kg`);
    expect(eachText(CIABATTA)).toBe(`4.64${NBSP}kg`);
  });

  it("keeps single packs as a count with what they add up to", () => {
    expect(packText(MILK, "Valio Eila 1 l")).toBe(`1,000 × Valio Eila 1 l = 1,000${NBSP}l`);
    expect(packCount(MILK)).toBe("×1,000");
    expect(packContent(MILK)).toBe(`1,000${NBSP}l`);
  });

  it("says one case in the singular", () => {
    expect(packText({ ...CIABATTA, quantity: 1, content: { amount: 4.64, unit: "kg" } }, "ciabatta")).toBe(`1 case of ciabatta = 4.64${NBSP}kg`);
  });

  it("gives goods sold by weight in kilograms only", () => {
    expect(packText(TOMATOES, "tomatoes")).toBe(`12${NBSP}kg of tomatoes`);
    expect(packCount(TOMATOES)).toBe(`12${NBSP}kg`);
    expect(packContent(TOMATOES)).toBeUndefined();
  });

  it("says what one unit price buys", () => {
    expect(priceUnit(CIABATTA)).toBe("per case");
    expect(priceUnit(MILK)).toBe("each");
    expect(priceUnit(TOMATOES)).toBe("per kg");
  });

  it("falls back to the pack count when the content is unknown", () => {
    expect(packText({ quantity: 4, salesUnit: "KI" }, "napkins")).toBe("4 cases of napkins");
    expect(packText({ quantity: 4, salesUnit: "ST" }, "napkins")).toBe("4 × napkins");
    expect(contentText({ quantity: 4, salesUnit: "ST" })).toBeUndefined();
    expect(eachText({ quantity: 0, salesUnit: "KI", content: { amount: 0, unit: "kg" } })).toBeUndefined();
  });

  it("carries the buyer's unit into every order line text", () => {
    const order = pendingOrder();
    expect(offerSubject(order.offer)).toBe(`1,800 × Arki Eila 1${NBSP}l = 1,800${NBSP}l`);
    expect(offeredLine(order.offer)).toBe(`Offered: 1,800 × Valio Arki Eila 1 l = 1,800${NBSP}l, Mon 16${NBSP}Nov`);
  });
});

describe("stock wording", () => {
  it("says stock is not tracked instead of a number", () => {
    expect(stockText(availability({ stock: "untracked" }))).toBe("stock not tracked");
  });

  it("gives the count only when it falls short", () => {
    expect(stockText(availability({ stock: "tracked", status: "partial", available: 51 }))).toBe("only 51 in stock");
    expect(stockText(availability({ stock: "tracked", available: 900 }))).toBeUndefined();
    expect(stockText(availability({}))).toBeUndefined();
  });
});
