import type { Recipe, RecipeSearch, RecipeSummary } from "@/lib/contracts";
import { NotFoundError } from "@/lib/gateway/errors";
import { recipeOf, summaryOf } from "./derive";
import { OWN_RECIPES } from "./library";
import { searchRecipes as search } from "./search";
import type { RecipeDef } from "./types";
import { VALIO_RECIPES } from "./valio";

export { BASE_PORTIONS, OWN_RECIPES, OWN_SOURCE } from "./library";
export { ROLES, WORDS } from "./roles";
export { everyLine, GLUTEN_ALLERGENS, isAnimal, recipeAllergens, recipeLabels, recipeOf, summaryOf } from "./derive";
export { occasionTags } from "./search";
export { VALIO_FILE, VALIO_IMPORTED_AT, VALIO_RECIPES } from "./valio";
export type {
  FoodKind,
  IngredientDef,
  ProductWords,
  RecipeDef,
  RecipeSource,
  RoleDef,
  RoleId,
  SwapDef,
  UnlistedLine,
} from "./types";

/**
 * The whole library: Valio's recipes first, then the team's own as a fallback. A menu id names dishes by their place
 * here, so new recipes are added at the end of their group.
 */
export const RECIPES: RecipeDef[] = [...VALIO_RECIPES, ...OWN_RECIPES];

/** What the planner builds menus from: recipes it can cost and order. */
export const PLANNER_RECIPES: RecipeDef[] = RECIPES.filter((def) => def.plannable);

export function recipeDef(id: string): RecipeDef | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

export function listRecipes(): RecipeSummary[] {
  return RECIPES.map(summaryOf);
}

/** Recipes by words, occasion, course and dietary needs; Valio's first. For the assistant, the API and MCP. */
export function searchRecipes(request: RecipeSearch = {}): RecipeSummary[] {
  return search(RECIPES, request);
}

export function getRecipe(id: string): Recipe {
  const def = recipeDef(id);
  if (!def) throw new NotFoundError(`No recipe has the id ${id}.`);
  return recipeOf(def);
}
