import type { Recipe, RecipeSummary } from "@/lib/contracts";
import type { FoodKind, ProductWords, RecipeDef } from "./types";

/** Allergen ids that mean gluten for a coeliac guest. */
export const GLUTEN_ALLERGENS = ["gluten", "wheat", "rye", "barley", "spelt"];

const ANIMAL: FoodKind[] = ["dairy", "egg", "meat", "fish"];

/** Every allergen the dish's ingredients bring, sorted. */
export function recipeAllergens(ingredients: Pick<ProductWords, "allergens">[]): string[] {
  return [...new Set(ingredients.flatMap((ingredient) => ingredient.allergens))].sort();
}

/** Lactose-free unless a milk ingredient still carries lactose. */
function lactoseFree(allergens: string[]): boolean {
  return !allergens.includes("lactose");
}

/** Labels that are true for the given ingredients: vegan, vegetarian, lactose_free, gluten_free. */
export function recipeLabels(ingredients: Pick<ProductWords, "allergens" | "kind">[]): string[] {
  const allergens = recipeAllergens(ingredients);
  const kinds = new Set(ingredients.map((ingredient) => ingredient.kind));
  const labels: string[] = [];
  if ([...kinds].every((kind) => kind === "plant")) labels.push("vegan");
  if (!kinds.has("meat") && !kinds.has("fish")) labels.push("vegetarian");
  if (lactoseFree(allergens)) labels.push("lactose_free");
  if (!allergens.some((allergen) => GLUTEN_ALLERGENS.includes(allergen))) labels.push("gluten_free");
  return labels;
}

export function isAnimal(kind: FoodKind): boolean {
  return ANIMAL.includes(kind);
}

/** Every line of the dish: what is ordered and what is not (basics, lines with no product), for allergens and kinds. */
export function everyLine(def: Pick<RecipeDef, "ingredients" | "unlisted">): Pick<ProductWords, "allergens" | "kind">[] {
  return [...def.ingredients, ...(def.unlisted ?? [])];
}

export function summaryOf(def: RecipeDef): RecipeSummary {
  const lines = everyLine(def);
  return {
    id: def.id,
    name: def.name,
    ...(def.nameFi ? { nameFi: def.nameFi } : {}),
    serves: def.serves,
    allergens: recipeAllergens(lines),
    labels: recipeLabels(lines),
    ...(def.minutes ? { minutes: def.minutes } : {}),
    course: def.course,
    source: def.source,
    ...(def.image ? { image: def.image } : {}),
    plannable: def.plannable,
    ...(def.fallback ? { fallback: true } : {}),
  };
}

export function recipeOf(def: RecipeDef): Recipe {
  return {
    ...summaryOf(def),
    occasions: def.occasions,
    method: def.method,
    ingredients: def.ingredients.map(({ words, amount, unit, role, purpose, allergens, asWritten, matched }) => ({
      words,
      amount,
      unit,
      role,
      purpose,
      allergens,
      ...(asWritten ? { asWritten } : {}),
      ...(matched ? { product: { id: matched.productId, name: matched.productName, confidence: matched.confidence } } : {}),
    })),
    notOrdered: (def.unlisted ?? []).map(({ asWritten, reason, allergens }) => ({ asWritten, reason, allergens })),
    ...(def.seasons?.length ? { seasons: def.seasons } : {}),
  };
}
