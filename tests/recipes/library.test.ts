import { describe, expect, it } from "vitest";
import { defaultMandate } from "@/lib/mandate";
import { fixtureCatalog } from "@/lib/catalog";
import { Recipe } from "@/lib/contracts";
import { dietRules } from "@/lib/menu/dietary";
import { displayName } from "@/lib/menu/display";
import { candidatesFor, marketFor, pricePerUnit } from "@/lib/menu/products";
import { RecordedUpstream } from "@/lib/valio";
import { OWN_RECIPES, RECIPES, ROLES, getRecipe, listRecipes, recipeAllergens, recipeLabels, type ProductWords } from "@/lib/recipes";

const catalog = fixtureCatalog();
/** No allergen rule at all, so the words alone decide what resolves. */
const OPEN = dietRules([], { ...defaultMandate(), dietary: { excludeAllergens: [], blockMayContain: false, requiredClaims: [] } });

/** A product's own milk sugar is part of milk: an ingredient that declares lactose or milk covers it. */
function declared(spec: ProductWords): Set<string> {
  return new Set([...spec.allergens, ...(spec.allergens.includes("milk") ? ["lactose"] : [])]);
}

const everyWords: [string, ProductWords][] = [
  ...RECIPES.flatMap((recipe) => recipe.ingredients.map((ingredient): [string, ProductWords] => [`${recipe.id}: ${ingredient.words}`, ingredient])),
  ...Object.entries(ROLES).flatMap(([role, def]) => def.swaps.map((swap): [string, ProductWords] => [`swap for ${role}: ${swap.words}`, swap])),
];

describe("the recipe library", () => {
  it("keeps our own two dozen recipes over every course as a marked fallback, the mentor's bolognese and cream cake among them", () => {
    expect(OWN_RECIPES.length).toBeGreaterThanOrEqual(24);
    expect(OWN_RECIPES.every((recipe) => recipe.fallback && recipe.source.name === "Laituri")).toBe(true);
    expect(RECIPES.slice(-OWN_RECIPES.length)).toEqual(OWN_RECIPES);
    expect(new Set(RECIPES.map((recipe) => recipe.course))).toEqual(new Set(["starter", "main", "side", "dessert", "drink"]));
    expect(RECIPES.map((recipe) => recipe.id)).toEqual(expect.arrayContaining(["pasta-bolognese", "cream-cake"]));
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(RECIPES.length);
    expect(OWN_RECIPES.every((recipe) => recipe.serves === 10)).toBe(true);
    expect(RECIPES.some((recipe) => recipe.occasions.includes("breakfast"))).toBe(true);
  });

  it.each(everyWords)("resolves %s to a recorded product", (_label, spec) => {
    expect(candidatesFor(spec, catalog, OPEN).length).toBeGreaterThan(0);
  });

  it.each(everyWords)("declares every allergen of the products %s resolves to", (_label, spec) => {
    for (const product of candidatesFor(spec, catalog, OPEN)) {
      const undeclared = product.allergens.contains.filter((allergen) => !declared(spec).has(allergen));
      expect(undeclared, `${product.id} ${product.name.en}`).toEqual([]);
    }
  });

  it("gives every ingredient a role with a purpose, and every role either a swap, a reason for none, or a way to leave it out", () => {
    for (const recipe of RECIPES) for (const ingredient of recipe.ingredients) expect(ingredient.purpose).toMatch(/^[\w -]+: \S/);
    for (const role of Object.values(ROLES)) expect(role.swaps.length > 0 || Boolean(role.noSwap) || Boolean(role.canOmit)).toBe(true);
  });

  it("derives allergens and labels from the ingredients", () => {
    const bolognese = getRecipe("pasta-bolognese");
    expect(bolognese.allergens).toEqual(["gluten", "milk", "wheat"]);
    expect(bolognese.labels).toEqual(["lactose_free"]);
    expect(getRecipe("gram-pancakes").labels).toEqual(["vegan", "vegetarian", "lactose_free", "gluten_free"]);
    expect(getRecipe("cream-cake").allergens).toEqual(["egg", "gluten", "milk", "wheat"]);
    expect(getRecipe("goat-cheese-crostini").labels).not.toContain("lactose_free");
    expect(recipeAllergens([{ allergens: ["milk"] }, { allergens: ["egg", "milk"] }])).toEqual(["egg", "milk"]);
    expect(recipeLabels([{ allergens: ["oats"], kind: "plant" }])).toEqual(["vegan", "vegetarian", "lactose_free", "gluten_free"]);
  });

  it("publishes recipes and summaries that match the contract", () => {
    expect(listRecipes()).toHaveLength(RECIPES.length);
    for (const recipe of RECIPES) expect(Recipe.safeParse(getRecipe(recipe.id)).success).toBe(true);
    expect(() => getRecipe("no-such-dish")).toThrow(/No recipe/);
  });
});

describe("prices in recorded mode", () => {
  it.each(everyWords)("has a recorded price per litre or kilo for %s", async (_label, spec) => {
    const products = candidatesFor(spec, catalog, OPEN);
    const market = await marketFor(products.map((product) => product.id), "2026-11-16", { upstream: new RecordedUpstream(), customerNumber: "123", orders: [], now: new Date("2026-11-14T09:00:00+02:00") });
    expect(products.some((product) => pricePerUnit(product, market) !== undefined)).toBe(true);
  });
});

describe("display names", () => {
  it.each([
    ["RED ONION FIN", "Red onion FIN"],
    ["TOMATO NL/BE/ES 1.CL", "Tomato NL/BE/ES 1.CL"],
    ["AIMO 2KG BEEF 3XMINCED MEAT 8%", "Aimo 2KG beef 3XMINCED meat 8%"],
    ["Valio Eila® butter 500 g", "Valio Eila® butter 500 g"],
  ])("writes %s as %s", (name, expected) => {
    expect(displayName(name)).toBe(expected);
  });
});
