import { describe, expect, it } from "vitest";
import { parseNameContent } from "@/lib/catalog/build/content";
import { categoryGroup } from "@/lib/catalog/build/groups";
import { parseValueCsv } from "@/lib/catalog/build/build-index";
import { assignConcept } from "@/lib/catalog/lexicon";
import { parseQuery } from "@/lib/catalog/query";

describe("content from product names", () => {
  it.each([
    ["Valio skimmed milk 10 l novobox", 10, "l"],
    ["Arla Portion milk 100x2 cl lactose free", 2, "l"],
    ["20 x Maltesers Chocolate sweets pouch 135g", 2.7, "kg"],
    ["Valio Eila® skimmed milk drink 1,75 l", 1.75, "l"],
    ["Zobanis 2,55/1,8kg natural garlic cloves", 1.8, "kg"],
    ["Atria New Finnish Frankfurter 5kg/33g", 5, "kg"],
  ])("reads %s", (name, amount, unit) => {
    const parsed = parseNameContent(name)!;
    expect(parsed.content.amount).toBeCloseTo(amount, 4);
    expect(parsed.content.unit).toBe(unit);
  });
});

describe("index vocabulary", () => {
  it("maps category codes to readable groups", () => {
    expect(categoryGroup("10400")).toBe("dairy");
    expect(categoryGroup("10602")).toBe("cheese");
    expect(categoryGroup("10590")).toBe("eggs");
    expect(categoryGroup("63100")).toBe("non_food");
    expect(categoryGroup("00000")).toBe("other");
  });

  it("keeps coffee milk and portion milk out of the milk concept", () => {
    expect(assignConcept("valio semi skimmed milk 1 l | valio kevytmaito 1 l", "10400")).toBe("milk");
    expect(assignConcept("valio coffee milk 1 l | valio kahvimaito 1 l", "10400")).toBe("coffee_milk");
    expect(assignConcept("arla portion milk 100x2 cl | arla annosmaito", "10400")).toBeUndefined();
  });

  it("reads delivery reliability CSV rows", () => {
    expect(parseValueCsv("productId,deliveryReliability\n460001,1.0\n460002,0.85\n460003,\n")).toEqual(
      new Map([["460001", 1], ["460002", 0.85]]),
    );
  });
});

describe("query parsing", () => {
  it("reads concept, claims, fat level and quantity", () => {
    const parsed = parseQuery("40 litraa laktoositonta kevytmaitoa");
    expect(parsed.concept?.id).toBe("milk");
    expect(parsed.claims).toEqual(["lactose_free"]);
    expect(parsed.fat).toBe("semi_skimmed");
    expect(parsed.quantity).toEqual({ amount: 40, unit: "l" });
    expect(parsed.leftovers).toEqual([]);
  });

  it("keeps unknown words as leftovers", () => {
    expect(parseQuery("Valio oat milk").leftovers).toEqual(["valio"]);
  });
});
