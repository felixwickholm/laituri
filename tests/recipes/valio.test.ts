import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "@/lib/catalog";
import { Recipe } from "@/lib/contracts";
import { BUYER_IDS, defaultMandate } from "@/lib/mandate";
import { costPerPortion, PLAUSIBLE_COST } from "@/lib/menu/cost";
import { getRecipe, PLANNER_RECIPES, searchRecipes, VALIO_FILE, VALIO_RECIPES } from "@/lib/recipes";
import { RecordedUpstream } from "@/lib/valio";
import { adaptRecipe } from "@/lib/menu/adapt";
import { dietRules } from "@/lib/menu/dietary";
import { importRecipe, portions, SLICE_KG } from "@/lib/recipes/valio/build";
import { allergensOf, lexiconEntry } from "@/lib/recipes/valio/lexicon";
import { BUCKETS } from "@/lib/recipes/valio/select";
import { NOW, plan } from "../menu/support";

const catalog = fixtureCatalog();

describe("Valio's recipes", () => {
  it("imports about 150 professional recipes, each with its page, portions and ingredients, attributed to Valio", () => {
    expect(VALIO_FILE.recipes.length).toBeGreaterThanOrEqual(100);
    expect(VALIO_FILE.recipes.length).toBeLessThanOrEqual(150);
    expect(VALIO_FILE.source.attribution).toBe("Recipe: Valio");
    expect(VALIO_FILE.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const recipe of VALIO_FILE.recipes) {
      expect(recipe.url, recipe.id).toMatch(/^https:\/\/www\.valioaimo\.fi\/reseptit\/[\w-]+\/$/);
      expect(recipe.serves, recipe.id).toBeGreaterThanOrEqual(4);
      expect(recipe.ingredients.length, recipe.id).toBeGreaterThan(0);
      expect(recipe.title.fi && recipe.title.en, recipe.id).toBeTruthy();
      expect(recipe.summary.split(/\s+/).length, recipe.id).toBeLessThanOrEqual(16);
      expect(JSON.stringify(recipe)).not.toMatch(/recipeInstructions|HowToStep/);
    }
  });

  it("matches ingredients only to products that exist, and lists every line it could not match", () => {
    for (const recipe of VALIO_FILE.recipes) {
      for (const line of recipe.ingredients) {
        if (line.match) expect(catalog.get(line.match.productId), `${recipe.id}: ${line.asWritten}`).toBeDefined();
        if (!line.basic && (!line.match || line.unmatched)) expect(line.unmatched, `${recipe.id}: ${line.asWritten}`).toBeTruthy();
      }
      const def = VALIO_RECIPES.find((entry) => entry.id === recipe.id)!;
      // Nothing is dropped: every line is either ordered or listed as not ordered.
      expect(def.ingredients.length + (def.unlisted?.length ?? 0), recipe.id).toBe(recipe.ingredients.length);
    }
  });

  it("serves recipes with their source and the lines it does not order", () => {
    for (const recipe of VALIO_RECIPES) {
      const served = getRecipe(recipe.id);
      expect(Recipe.safeParse(served).success, recipe.id).toBe(true);
      expect(served.source).toEqual({ name: "Valio", url: expect.stringContaining("valioaimo.fi"), attribution: "Recipe: Valio" });
    }
  });

  it("holds the mentor's bolognese and cream cake from Valio, ready to plan", () => {
    const planned = new Set(PLANNER_RECIPES.map((recipe) => recipe.id));
    expect(planned.has("valio-pikantti-jauhelihakastike")).toBe(true);
    expect(PLANNER_RECIPES.some((recipe) => recipe.source.name === "Valio" && /kakku/.test(recipe.nameFi ?? ""))).toBe(true);
  });

  it("costs every recipe the planner uses at a plausible food cost per guest for 80 guests", async () => {
    const valio = PLANNER_RECIPES.filter((recipe) => recipe.source.name === "Valio");
    expect(valio.length).toBeGreaterThanOrEqual(30);
    const costs = await costPerPortion(valio, 80, {
      catalog,
      upstream: new RecordedUpstream(),
      mandate: defaultMandate(BUYER_IDS.nordicHarbour),
      now: NOW,
      deliverBy: "2026-11-20",
    });
    const wrong = valio.flatMap((recipe) => {
      const cost = costs.get(recipe.id);
      const range = PLAUSIBLE_COST[recipe.course];
      return cost !== undefined && cost >= range.min && cost <= range.max ? [] : [`${recipe.id} (${recipe.course}): ${cost}`];
    });
    expect(wrong).toEqual([]);
  });
});

describe("a wedding from Valio's recipes", () => {
  it("plans 'Wedding dinner for 80 on Saturday, no nuts' at a plausible cost per guest, from Valio first", async () => {
    const result = await plan({ words: "Wedding dinner for 80 on Saturday, no nuts" });
    expect(result.menus).toHaveLength(3);
    for (const menu of result.menus) {
      expect(menu.costPerGuest, menu.name).toBeGreaterThanOrEqual(1);
      expect(menu.costPerGuest, menu.name).toBeLessThanOrEqual(40);
      expect(menu.toOrderNet).toBeGreaterThan(0);
      for (const { recipe } of menu.courses) {
        expect(recipe.source?.name, recipe.id).toBe("Valio");
        expect(recipe.allergens).not.toContain("nuts");
      }
      expect(menu.fits).toContainEqual({ ok: true, sentence: "No nuts in any dish." });
    }
    expect(result.notes.some((note) => note.startsWith("Recipes: Valio"))).toBe(true);
  });
});

describe("recipe search", () => {
  it("finds Valio's cream cakes first by English or Finnish words", () => {
    expect(searchRecipes({ words: "cream cake" })[0].id).toBe("valio-kermakakku");
    expect(searchRecipes({ words: "kermakakku" }).some((recipe) => recipe.id === "valio-kermakakku")).toBe(true);
  });

  it("puts Christmas dishes first for a Christmas party and keeps every dietary need", () => {
    const found = searchRecipes({ occasion: "Christmas party", dietary: ["nut_free", "gluten_free"] });
    expect(found.length).toBeGreaterThan(0);
    expect(getRecipe(found[0].id).seasons).toContain("joulu");
    for (const recipe of found) {
      expect(recipe.labels).toContain("gluten_free");
      expect(recipe.allergens.filter((allergen) => ["nuts", "almond", "peanut"].includes(allergen))).toEqual([]);
    }
  });

  it("returns only what the planner can use when asked, our own recipes after Valio's", () => {
    const found = searchRecipes({ course: "main", plannable: true, limit: 200 });
    expect(found.every((recipe) => recipe.plannable && recipe.course === "main")).toBe(true);
    const firstOwn = found.findIndex((recipe) => recipe.fallback);
    expect(found.slice(firstOwn).every((recipe) => recipe.fallback)).toBe(true);
  });
});

describe("reading Valio's ingredient lines", () => {
  const raw = (name: string, lines: string[], recipeYield = "20, 20 annosta", recipeCategory = "Pääruoat") => ({ name, recipeIngredient: lines, recipeYield, recipeCategory, keywords: "" });
  const fish = BUCKETS.find((bucket) => bucket.id === "fish")!;
  const dessert = BUCKETS.find((bucket) => bucket.id === "dessert")!;

  it("reads flour in a yeast dough as the dough itself, with no swap, so the dish is left out for coeliacs", () => {
    const pizza = importRecipe("lohipizza", "https://example.test/lohipizza/", raw("Lohipizza", ["2,000 kg vehnäjauhoja", "0,050 kg hiivaa", "1,000 kg lohifileetä"]), fish, catalog)!;
    expect(pizza.ingredients.find((line) => line.name === "vehnäjauhoja")?.match?.role).toBe("wheat_dough");
    const sauce = importRecipe("kalakastike", "https://example.test/kalakastike/", raw("Kalakastike", ["0,100 kg vehnäjauhoja", "1,000 kg lohifileetä"]), fish, catalog)!;
    expect(sauce.ingredients.find((line) => line.name === "vehnäjauhoja")?.match?.role).toBe("wheat_thickener");
    const def = PLANNER_RECIPES.concat(VALIO_RECIPES).find((recipe) => recipe.id === "valio-lohipizza")!;
    expect(def.ingredients.find((line) => line.words === "wheat flour")?.role).toBe("wheat_dough");
    const coeliac = adaptRecipe(def, dietRules(["gluten_free"], defaultMandate(BUYER_IDS.nordicHarbour)), ["gluten_free"]);
    expect(coeliac.ok).toBe(false);
  });

  it("reads 'sitruunapastaa' as lemon paste, not as pasta, and finds real pasta still", () => {
    expect(lexiconEntry("sitruunapastaa")?.key).toBeUndefined();
    expect(allergensOf("sitruunapastaa", false)).not.toContain("gluten");
    for (const name of ["perhospastaa", "kierrepastaa", "tuorepastaa", "pastaa", "täysjyväpastaa"]) {
      expect(lexiconEntry(name)?.key, name).toBe("fusilli");
      expect(allergensOf(name, false), name).toContain("gluten");
    }
  });

  it("counts a dessert piece heavier than a portion as a whole cake, cut into slices", () => {
    expect(portions("16, 16 kpl", 6.33, "dessert", "Rahkavuoka")).toBe(Math.round(6.33 / SLICE_KG));
    expect(portions("55, 55 kpl", 5.72, "dessert", "Rahkaleivos")).toBe(55);
    expect(portions("19, 19 kpl", 7.17, "main", "Lihapiirakka")).toBe(19);
    const bake = importRecipe("rahkavuoka", "https://example.test/rahkavuoka/", raw("Rahkavuoka", ["4,000 kg maitorahkaa", "1,000 kg sokeria", "1,330 kg kananmunia"], "16, 16 kpl", "Jälkiruoat"), dessert, catalog)!;
    expect(bake.serves).toBe(Math.round(6.33 / SLICE_KG));
    const imported = VALIO_FILE.recipes.find((recipe) => recipe.slug === "rahkavuoka")!;
    const kg = imported.ingredients.reduce((sum, line) => sum + (line.quantity?.amount ?? 0), 0);
    expect(kg / imported.serves).toBeLessThanOrEqual(0.15);
  });
});
