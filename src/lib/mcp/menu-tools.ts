import { z } from "zod";
import { MenuPlanRequest, PreviousMenu, RecipeSearch, type MenuPlan, type RecipeSummary } from "@/lib/contracts";
import type { AgentRef } from "@/lib/gateway";
import { CredentialRequiredError } from "@/lib/http/reader";
import { planMenuFor } from "@/lib/menu/service";
import { eur } from "@/lib/offers/format";
import { listRecipes, searchRecipes } from "@/lib/recipes";
import type { ToolDefinition } from "./tools";

/**
 * MCP tool inputs are one object, so plan_menu takes the fields of both request forms; the REST schema then decides
 * which form was meant.
 */
export const PlanMenuInput = z.object({
  words: z.string().optional().describe("The event in plain words, English or Finnish. Or give guests and date instead"),
  guests: z.number().int().optional(),
  date: z.string().optional().describe("YYYY-MM-DD"),
  occasion: z.string().optional(),
  dietary: z.array(z.string()).optional().describe("For example nut_free, gluten_free, vegan"),
  budgetPerGuest: z.number().optional(),
  previous: PreviousMenu.optional().describe("An earlier menu id and its guests, to see what changes"),
});

function planText(plan: MenuPlan): string {
  // A per-guest cost that leaves items out says so in the same line, so a model never quotes it as the full cost.
  const menus = plan.menus.map(
    (menu) =>
      `${menu.tier}: ${menu.name}, ${eur(menu.costPerGuest)} per guest${menu.unpriced ? `, not counting ${menu.unpriced} ${menu.unpriced === 1 ? "item" : "items"} without a price` : ""} (${menu.id})`,
  );
  return [plan.understood, ...(plan.question ? [plan.question] : []), ...menus].join("\n");
}

function recipesText(result: { recipes: RecipeSummary[] }): string {
  const names = result.recipes.map((recipe) => `${recipe.name} (${recipe.source?.attribution === "Recipe: Valio" ? "Recipe: Valio" : "our own"})`);
  return `${result.recipes.length} recipes: ${names.join(", ")}.`;
}

/** The buyer whose mandate a menu is planned under: the key's buyer. A call without a key has none. */
function keyBuyer(agent: AgentRef): string {
  if (!agent.buyer) throw new CredentialRequiredError("a menu plan");
  return agent.buyer.id;
}

export const MENU_TOOLS: ToolDefinition[] = [
  {
    name: "plan_menu",
    title: "Plan a menu for an event",
    description:
      "Use when a kitchen describes an event (\"Wedding dinner for 80 on Friday, two guests are coeliac, no nuts\", Finnish too). " +
      "Returns what was understood and three menus (good, better, best by cost per guest) from Valio's professional recipes (our own as a fallback), fitted to your mandate's allergen rules " +
      "and the event's dietary needs by recipe-role swaps, each with a shopping list net of the kitchen's stock, indicative net prices for the delivery date, " +
      "checked facts and warnings. Prices are not signed: to order, post the chosen menu's lines with toOrder above zero to POST /api/v1/baskets " +
      "(source menu, menuId), or quote and order them line by line. When the event changes, call again with previous {menuId, guests}. " +
      "If the words give no guest count, the answer has needs [\"guests\"] and a question: ask your human, then call again.",
    operationId: "planMenu",
    input: PlanMenuInput,
    output: "MenuPlan",
    run: (agent: AgentRef, input: z.infer<typeof PlanMenuInput>) => planMenuFor(keyBuyer(agent), MenuPlanRequest.parse(input)),
    summarize: planText,
  } as unknown as ToolDefinition,
  {
    name: "list_recipes",
    title: "List the recipe library",
    description:
      "Use to see or search the dishes plan_menu builds menus from: Valio's professional recipes first, our own after. Each has portions, " +
      "allergens derived from its ingredients, labels and its source; show \"Recipe: Valio\" with Valio's. Give words, occasion, course, " +
      "dietary or plannable to search; nothing lists every recipe.",
    operationId: "listRecipes",
    input: RecipeSearch,
    output: "RecipeList",
    run: async (_agent: AgentRef, input: RecipeSearch = {}) =>
      ({ recipes: Object.values(input ?? {}).some((value) => value !== undefined) ? searchRecipes(input) : listRecipes() }),
    summarize: recipesText,
  } as unknown as ToolDefinition,
];
