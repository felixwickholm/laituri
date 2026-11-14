import type { DietaryNeed, KitchenUnit, RecipeSummary } from "@/lib/contracts";
import { ROLES, recipeAllergens, recipeLabels, summaryOf, type ProductWords, type RecipeDef, type RoleId } from "@/lib/recipes";
import { keptSentence, needsBroken, wordsSafe, type DietRules } from "./dietary";

/** One ingredient as this event will use it: as written, swapped for a rule, or left out. */
export interface PlannedIngredient {
  /** The recipe's own words. */
  original: string;
  /** What is actually bought. */
  spec: ProductWords;
  amount: number;
  unit: KitchenUnit;
  role: RoleId;
  /** Set when a rule forced a swap; never silent. */
  swap?: { words: string; reason: string };
  omitted?: boolean;
}

export interface AdaptedDish {
  def: RecipeDef;
  items: PlannedIngredient[];
  /** The dish as served: allergens and labels after swaps. */
  summary: RecipeSummary;
}

export type Adaptation = { ok: true; dish: AdaptedDish } | { ok: false; def: RecipeDef; reason: string };

/**
 * A dish fitted to the rules by recipe logic: each ingredient that breaks a rule takes the first safe stand-in for its
 * role, or is left out when the dish works without it. A dish whose ingredient has neither cannot be served.
 */
export function adaptRecipe(def: RecipeDef, rules: DietRules, needs: DietaryNeed[]): Adaptation {
  // A line that is never ordered (a basic, or no product) cannot be swapped: if it breaks a rule, the dish cannot be served.
  const unsafe = (def.unlisted ?? []).find((line) => !wordsSafe(line, rules));
  if (unsafe) return { ok: false, def, reason: `It needs ${unsafe.words ?? unsafe.asWritten.replace(/^[\d,.]+ kg /, "")}, which nothing can stand in for.` };
  const items: PlannedIngredient[] = [];
  for (const ingredient of def.ingredients) {
    const base = { original: ingredient.words, amount: ingredient.amount, unit: ingredient.unit, role: ingredient.role };
    if (wordsSafe(ingredient, rules)) {
      items.push({ ...base, spec: ingredient });
      continue;
    }
    const role = ROLES[ingredient.role];
    const swap = role.swaps.find((candidate) => wordsSafe(candidate, rules));
    if (swap) {
      items.push({ ...base, spec: swap, swap: { words: swap.words, reason: `${swap.change} ${keptSentence(needsBroken(ingredient, needs))}` } });
    } else if (role.canOmit) {
      items.push({ ...base, spec: ingredient, omitted: true, swap: { words: "leave it out", reason: role.canOmit } });
    } else {
      return { ok: false, def, reason: role.noSwap ?? `No swap keeps the ${ingredient.words} safe.` };
    }
  }
  const used = [...items.filter((item) => !item.omitted).map((item) => item.spec), ...(def.unlisted ?? [])];
  return {
    ok: true,
    dish: {
      def,
      items,
      summary: { ...summaryOf(def), allergens: recipeAllergens(used), labels: recipeLabels(used) },
    },
  };
}
