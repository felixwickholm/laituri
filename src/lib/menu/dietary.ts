import type { DietaryNeed, Mandate, Product } from "@/lib/contracts";
import { GLUTEN_ALLERGENS, isAnimal, type FoodKind, type ProductWords } from "@/lib/recipes";

/** Allergen ids each need rules out. Vegetarian and vegan rule out kinds of food instead. */
const EXCLUDES: Record<DietaryNeed, string[]> = {
  nut_free: ["nuts", "almond", "peanut"],
  peanut_free: ["peanut"],
  gluten_free: GLUTEN_ALLERGENS,
  lactose_free: ["lactose"],
  milk_free: ["milk", "lactose"],
  egg_free: ["egg"],
  fish_free: ["fish"],
  sesame_free: ["sesame"],
  soy_free: ["soy"],
  vegetarian: [],
  vegan: [],
};

/** How the planner says each need back: "no nuts". */
export const NEED_PHRASE: Record<DietaryNeed, string> = {
  nut_free: "no nuts",
  peanut_free: "no peanuts",
  gluten_free: "gluten-free",
  lactose_free: "lactose-free",
  milk_free: "no milk",
  egg_free: "no egg",
  fish_free: "no fish",
  sesame_free: "no sesame",
  soy_free: "no soy",
  vegetarian: "vegetarian",
  vegan: "vegan",
};

/** A mandate's "nuts" covers almonds too: the catalogue lists both on almond products. */
const MANDATE_ALIASES: Record<string, string[]> = { nuts: ["nuts", "almond"] };

/** Everything one plan must respect: the buyer's mandate and the event's needs. */
export interface DietRules {
  /** Allergen ids no product may contain. */
  excluded: string[];
  /** Allergen ids no product may even list as "may contain". */
  excludedTraces: string[];
  vegetarian: boolean;
  vegan: boolean;
  /** Category groups the agent may buy alone. Others need a person. */
  allowedCategories: string[];
  /** The buyer's never-buy list: no product on it is ever picked. */
  neverBuy?: Mandate["dietary"]["neverBuy"];
  /** Labels every product must carry (the mandate's requiredClaims): products that carry them are picked first. */
  requiredClaims: string[];
}

/**
 * The event's needs block traces too: a guest's allergy is strict. The mandate's own exclusions block traces only
 * when it says so (blockMayContain).
 */
export function dietRules(needs: DietaryNeed[], mandate: Mandate): DietRules {
  const fromMandate = mandate.dietary.excludeAllergens.flatMap((id) => MANDATE_ALIASES[id] ?? [id]);
  const fromEvent = needs.flatMap((need) => EXCLUDES[need]);
  const excluded = [...new Set([...fromMandate, ...fromEvent])].sort();
  const traces = mandate.dietary.blockMayContain ? excluded : [...new Set(fromEvent)].sort();
  return {
    excluded,
    excludedTraces: traces,
    vegetarian: needs.includes("vegetarian") || needs.includes("vegan"),
    vegan: needs.includes("vegan"),
    allowedCategories: mandate.categories.allowed,
    neverBuy: mandate.dietary.neverBuy,
    requiredClaims: [...mandate.dietary.requiredClaims],
  };
}

/**
 * The required labels a product does not carry. The same test as the policy's dietary.claims rule
 * (src/lib/policy/rules/products.ts): a claim counts only when the product lists it, whatever the product is. So the
 * planner warns about exactly what an order would be blocked for.
 */
export function missingClaims(product: Pick<Product, "claims">, required: string[]): string[] {
  return required.filter((claim) => !product.claims.includes(claim));
}

export function kindAllowed(kind: FoodKind, rules: DietRules): boolean {
  if (rules.vegan) return !isAnimal(kind);
  if (rules.vegetarian) return kind !== "meat" && kind !== "fish";
  return true;
}

/** An ingredient as written is safe when it brings no excluded allergen and its kind is allowed. */
export function wordsSafe(product: Pick<ProductWords, "allergens" | "kind">, rules: DietRules): boolean {
  return kindAllowed(product.kind, rules) && !product.allergens.some((allergen) => rules.excluded.includes(allergen));
}

/** A real product is safe when its declared contents and traces meet the rules. */
export function productSafe(allergens: { contains: string[]; mayContain: string[] }, rules: DietRules): boolean {
  if (allergens.contains.some((allergen) => rules.excluded.includes(allergen))) return false;
  return !allergens.mayContain.some((allergen) => rules.excludedTraces.includes(allergen));
}

/** How a swap reason names the need it keeps: "Keeps it gluten-free." */
const KEPT: Record<DietaryNeed, string> = {
  nut_free: "nut-free",
  peanut_free: "peanut-free",
  gluten_free: "gluten-free",
  lactose_free: "lactose-free",
  milk_free: "milk-free",
  egg_free: "egg-free",
  fish_free: "fish-free",
  sesame_free: "sesame-free",
  soy_free: "soy-free",
  vegetarian: "vegetarian",
  vegan: "vegan",
};

/** The event's needs an ingredient breaks, as written. */
export function needsBroken(product: Pick<ProductWords, "allergens" | "kind">, needs: DietaryNeed[]): DietaryNeed[] {
  return needs.filter((need) => {
    if (need === "vegan") return isAnimal(product.kind);
    if (need === "vegetarian") return product.kind === "meat" || product.kind === "fish";
    return product.allergens.some((allergen) => EXCLUDES[need].includes(allergen));
  });
}

/** Why a rule swap was made, in one short sentence. */
export function keptSentence(broken: DietaryNeed[]): string {
  return broken.length ? `Keeps it ${broken.slice(0, 2).map((need) => KEPT[need]).join(" and ")}.` : "Meets your allergen rules.";
}

export function isDietaryNeed(value: string): value is DietaryNeed {
  return value in EXCLUDES;
}
