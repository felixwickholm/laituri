import { ROLES, WORDS } from "../roles";
import type { IngredientDef, RecipeDef, RecipeSource, RoleId, UnlistedLine } from "../types";
import data from "./recipes.json";
import type { ValioFile, ValioIngredient, ValioRecipe } from "./types";

export type { ValioFile, ValioIngredient, ValioRecipe } from "./types";

/** The imported file: Valio Aimo's professional recipes, matched to the recorded catalogue. */
export const VALIO_FILE = data as unknown as ValioFile;

/** The day the recipes were read from valioaimo.fi. */
export const VALIO_IMPORTED_AT = VALIO_FILE.importedAt;

function roleOf(role: string): RoleId {
  return role in ROLES ? (role as RoleId) : "as_written";
}

/** A matched line with an amount, as the planner orders it. */
function ingredientOf(line: ValioIngredient): IngredientDef | undefined {
  const match = line.match;
  if (!match || line.unmatched || !line.quantity?.amount || line.basic) return undefined;
  const known = match.key ? WORDS[match.key as keyof typeof WORDS] : undefined;
  const role = roleOf(match.role);
  return {
    words: match.words,
    ...(match.claims ? { claims: match.claims } : {}),
    ...(match.nameHas ? { nameHas: match.nameHas } : {}),
    allergens: line.allergens,
    kind: known?.kind ?? line.kind,
    amount: line.quantity.amount,
    unit: line.quantity.unit,
    role,
    purpose: `${match.words}: ${ROLES[role].label}`,
    asWritten: line.asWritten,
    matched: { productId: match.productId, productName: match.productName, confidence: match.confidence },
  };
}

function unlistedOf(line: ValioIngredient): UnlistedLine | undefined {
  if (ingredientOf(line)) return undefined;
  return {
    asWritten: line.asWritten,
    ...(line.match ? { words: line.match.words } : {}),
    allergens: line.allergens,
    kind: line.kind,
    basic: Boolean(line.basic),
    reason: line.basic ? "Kitchen basic." : (line.unmatched ?? "Not in the recorded catalogue."),
  };
}

export function valioDef(recipe: ValioRecipe): RecipeDef {
  const source: RecipeSource = { name: "Valio", url: recipe.url, attribution: VALIO_FILE.source.attribution };
  return {
    id: recipe.id,
    name: recipe.title.en,
    nameFi: recipe.title.fi,
    course: recipe.course,
    occasions: recipe.occasions,
    serves: recipe.serves,
    ...(recipe.minutes ? { minutes: recipe.minutes } : {}),
    method: recipe.summary,
    ingredients: recipe.ingredients.flatMap((line) => ingredientOf(line) ?? []),
    unlisted: recipe.ingredients.flatMap((line) => unlistedOf(line) ?? []),
    source,
    ...(recipe.image ? { image: recipe.image } : {}),
    seasons: recipe.seasons,
    searchText: [recipe.title.fi, recipe.title.en, ...recipe.tags, ...recipe.ingredients.map((line) => line.name)].join(" | ").toLowerCase(),
    plannable: recipe.plannable,
  };
}

/** Valio's recipes in the library's shape, in import order. */
export const VALIO_RECIPES: RecipeDef[] = VALIO_FILE.recipes.map(valioDef);
