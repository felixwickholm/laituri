import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { catalog, type Catalog } from "@/lib/catalog";
import { SearchResponse } from "@/lib/contracts";

let c: Catalog;

beforeAll(() => {
  process.env.VALIO_MODE = "recorded";
  process.env.LAITURI_CATALOG = path.join(process.cwd(), "fixtures", "upstream", "catalog.json");
  c = catalog();
});

function search(query: string, extra: Partial<Parameters<Catalog["search"]>[0]> = {}) {
  const response = c.search({ query, limit: 10, ...extra });
  return SearchResponse.parse(response);
}

const NOT_MILK = /(coffee|kahvi|café|cafè|cream|kerma|grädde|portion|annos)/i;

describe("catalog search", () => {
  it.each(["lactose-free milk", "laktoositon maito", "laktosfri mjölk"])("finds lactose-free milk for %s", (query) => {
    const result = search(query);
    expect(result.interpretation).toMatchObject({ concept: "milk", claims: ["lactose_free"], confidence: "high" });
    expect(result.hits.length).toBeGreaterThan(5);
    for (const hit of result.hits) {
      expect(hit.product.concept).toBe("milk");
      expect(hit.product.claims).toContain("lactose_free");
      expect(hit.product.name.en).not.toMatch(NOT_MILK);
    }
    expect(result.hits.slice(0, 5).map((h) => h.product.id)).toContain("464306");
  });

  it("returns plain milk for milk", () => {
    const result = search("milk");
    expect(["high", "medium"]).toContain(result.interpretation.confidence);
    expect(result.interpretation.concept).toBe("milk");
    for (const hit of result.hits) expect(hit.product.name.en).not.toMatch(NOT_MILK);
  });

  it("returns nothing for an unknown product", () => {
    const result = search("unobtainium 3000");
    expect(result.hits).toEqual([]);
    expect(result.interpretation.confidence).toBe("low");
    expect(result.interpretation.note).toBeTruthy();
  });

  it("prefers the requested fat level", () => {
    const result = search("kevytmaito laktoositon");
    expect(result.interpretation.confidence).toBe("high");
    expect(result.hits[0].product.name.en).toMatch(/semi|low fat/i);
  });

  it("prefers bulk packs for a large quantity", () => {
    const result = search("lactose-free milk 40 l");
    expect(result.hits[0].product.content!.amount).toBeGreaterThanOrEqual(10);
  });

  it("removes products that contain an excluded allergen", () => {
    const all = search("cheese", { limit: 50 });
    expect(all.hits.some((h) => h.product.allergens.contains.includes("milk"))).toBe(true);
    const result = search("whipping cream", { filters: { excludeAllergens: ["milk"] }, limit: 50 });
    for (const hit of result.hits) expect(hit.product.allergens.contains).not.toContain("milk");
    expect(search("milk", { filters: { excludeAllergens: ["milk"] } }).hits).toEqual([]);
  });

  it("applies claim filters from the request", () => {
    const result = search("milk", { filters: { claims: ["lactose_free"] }, limit: 50 });
    expect(result.hits.length).toBeGreaterThan(0);
    for (const hit of result.hits) expect(hit.product.claims).toContain("lactose_free");
  });

  it("says when a known product type has no match for the claims", () => {
    const result = search("gluten-free milk");
    expect(result.interpretation.confidence).toBe("low");
    expect(result.hits).toEqual([]);
  });
});

describe("substitutes", () => {
  it("offers lactose-free milks for 464306, listed substitutes first", () => {
    const subs = c.substitutesFor("464306", 8);
    expect(subs.length).toBeGreaterThan(3);
    const listed = c.get("464306")!.substitutes.filter((id) => c.get(id));
    expect(subs.slice(0, listed.length).map((p) => p.id)).toEqual(listed);
    for (const product of subs) {
      expect(product.concept).toBe("milk");
      expect(product.claims).toContain("lactose_free");
      expect(product.id).not.toBe("464306");
    }
  });

  it("returns nothing for an unknown id", () => {
    expect(c.substitutesFor("nope")).toEqual([]);
  });
});
