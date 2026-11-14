import { describe, expect, it } from "vitest";
import type { DietaryNeed } from "@/lib/contracts";
import { BUYER_IDS, defaultMandate } from "@/lib/mandate";
import { adaptRecipe } from "@/lib/menu/adapt";
import { dietRules, needsBroken, wordsSafe } from "@/lib/menu/dietary";
import { recipeDef } from "@/lib/recipes";

function adapt(id: string, needs: DietaryNeed[], buyer: string = BUYER_IDS.laine) {
  return adaptRecipe(recipeDef(id)!, dietRules(needs, defaultMandate(buyer)), needs);
}

describe("recipe-role swaps", () => {
  it("swaps pasta for rice in a gluten-free bolognese, and says so", () => {
    const result = adapt("pasta-bolognese", ["gluten_free"]);
    if (!result.ok) throw new Error(result.reason);
    const pasta = result.dish.items.find((item) => item.original === "fusilli")!;
    expect(pasta.spec.words).toBe("rice");
    expect(pasta.swap).toEqual({ words: "rice", reason: "Rice works with this sauce. Serve it on the side. Keeps it gluten-free." });
    expect(result.dish.summary.labels).toContain("gluten_free");
  });

  it("swaps cream for oat fraiche when milk is out, and keeps the taste note", () => {
    const result = adapt("salmon-soup", ["milk_free"]);
    if (!result.ok) throw new Error(result.reason);
    const cream = result.dish.items.find((item) => item.original === "cooking cream")!;
    expect(cream.swap?.reason).toBe("Oat fraiche works in this sauce. The taste is a little lighter. Keeps it milk-free.");
    const butter = result.dish.items.find((item) => item.original === "lactose-free butter")!;
    expect(butter.spec.words).toBe("vegetable spread");
    expect(result.dish.summary.allergens).not.toContain("milk");
  });

  it("refuses a dish whose role has no safe stand-in, with the reason", () => {
    expect(adapt("meringue-cream", ["egg_free"])).toMatchObject({ ok: false, reason: "No swap: the meringue needs egg white." });
    expect(adapt("cream-cake", ["egg_free"])).toMatchObject({ ok: false, reason: "No swap: the sponge needs eggs to rise." });
    expect(adapt("cream-cake", ["gluten_free"])).toMatchObject({ ok: false, reason: "No swap: the sponge needs wheat flour." });
    expect(adapt("scrambled-eggs", ["egg_free"])).toMatchObject({ ok: false, reason: "No swap: eggs are the dish." });
  });

  it("leaves the cheese out of a milk-free bolognese rather than buying unsafe cheese", () => {
    const result = adapt("pasta-bolognese", ["milk_free"]);
    if (!result.ok) throw new Error(result.reason);
    const cheese = result.dish.items.find((item) => item.original === "grated cheese")!;
    expect(cheese.omitted).toBe(true);
    expect(cheese.swap).toEqual({ words: "leave it out", reason: "Leave the cheese out. The dish is less rich." });
  });

  it("binds meatballs with gram flour when egg is out", () => {
    const result = adapt("meatballs-mash", ["egg_free"]);
    if (!result.ok) throw new Error(result.reason);
    expect(result.dish.items.find((item) => item.original === "eggs")?.swap?.words).toBe("gram flour");
  });

  it("never swaps silently: every changed ingredient carries a reason, and every result is safe", () => {
    const needs: DietaryNeed[][] = [["gluten_free"], ["milk_free"], ["egg_free"], ["vegan"], ["vegetarian"], ["nut_free", "gluten_free"]];
    for (const need of needs) {
      const rules = dietRules(need, defaultMandate(BUYER_IDS.kaisla));
      for (const id of ["pasta-bolognese", "salmon-soup", "meatballs-mash", "beef-lasagne", "smoked-salmon-flatbread", "quark-mousse"]) {
        const result = adaptRecipe(recipeDef(id)!, rules, need);
        if (!result.ok) continue;
        for (const item of result.dish.items) {
          if (item.spec.words !== item.original || item.omitted) expect(item.swap?.reason, `${id} ${item.original}`).toBeTruthy();
          if (!item.omitted) expect(wordsSafe(item.spec, rules)).toBe(true);
        }
      }
    }
  });

  it("follows the mandate too: a school kitchen's rules count as much as the event's", () => {
    const rules = dietRules([], defaultMandate(BUYER_IDS.kaisla));
    expect(rules.excluded).toEqual(["almond", "nuts", "peanut", "sesame"]);
    expect(rules.excludedTraces).toEqual(rules.excluded);
    expect(needsBroken({ allergens: ["gluten", "wheat"], kind: "plant" }, ["gluten_free", "vegan"])).toEqual(["gluten_free"]);
  });
});
