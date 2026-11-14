import type { Operation } from "./registry";

const buyerQuery = {
  name: "buyer",
  in: "query",
  type: "string",
  description: "Buyer id. Defaults to the signed-in approver's buyer, else the primary buyer. An agent token reads only its own buyer.",
} as const;

/** Need -> recipe -> order: the menu planner, the recipe library, the kitchen's stock and the suggestions. */
export const MENU_OPERATIONS: Operation[] = [
  { operationId: "planMenu", method: "post", path: "/api/v1/menus/plan", tag: "Menus", audience: "reader",
    summary: "Plan three menus for an event, with shopping lists",
    description:
      "Give the event in words (English or Finnish) or as guests and date. Returns what was understood and three menus " +
      "(good, better, best by cost per guest) fitted to the buyer's mandate and the event's dietary needs by recipe-role swaps, " +
      "each with a shopping list net of the kitchen's stock, indicative net prices and availability for the delivery date, checked facts and warnings. " +
      "No offer is signed at planning time. To order, post the chosen menu's lines to POST /api/v1/baskets with source menu and the menuId. " +
      "With previous {menuId, guests}, each menu also says what changes. Words without a guest count answer 200 with needs [\"guests\"], a question and no menus.",
    parameters: [buyerQuery], body: "MenuPlanRequest", response: "MenuPlan", errors: [400, 401, 403, 502] },
  { operationId: "listRecipes", method: "get", path: "/api/v1/recipes", tag: "Menus", audience: "public",
    summary: "The recipe library: Valio's professional recipes, then our own as a fallback; or a search",
    description:
      "Without a query, every recipe. With any of words, occasion, course, dietary or plannable, a ranked search: words in the title, Valio's tags " +
      "or the ingredients (Finnish or English), the occasion's tags with Christmas dishes first for a Christmas party, and dietary needs met as written. " +
      "Each recipe carries its source; show source.attribution (\"Recipe: Valio\") with it.",
    parameters: [
      { name: "words", in: "query", type: "string", description: "For example cream cake, lohi, bolognese" },
      { name: "occasion", in: "query", type: "string", description: "wedding, Christmas party, buffet, lunch, breakfast, dinner" },
      { name: "course", in: "query", type: "string", description: "starter, main, side, dessert or drink" },
      { name: "dietary", in: "query", type: "string", description: "Comma-separated needs, for example nut_free,gluten_free" },
      { name: "plannable", in: "query", type: "string", description: "true: only recipes the planner can cost and order" },
      { name: "limit", in: "query", type: "string", description: "1 to 200; 20 by default for a search" },
    ],
    response: "RecipeList", errors: [400] },
  { operationId: "getRecipe", method: "get", path: "/api/v1/recipes/{id}", tag: "Menus", audience: "public",
    summary: "One recipe with its ingredients, their culinary roles and catalogue products, its source and the lines it does not order",
    parameters: [{ name: "id", in: "path", description: "Recipe id, for example valio-kermakakku or pasta-bolognese", required: true, type: "string" }],
    response: "Recipe", errors: [404] },
  { operationId: "getPantry", method: "get", path: "/api/v1/pantry", tag: "Menus", audience: "reader",
    summary: "What the kitchen has in stock (demo data)", parameters: [buyerQuery], response: "PantryList", errors: [400, 401, 403] },
  { operationId: "listSuggestions", method: "get", path: "/api/v1/suggestions", tag: "Menus", audience: "reader",
    summary: "What the buyer's agent proposes before anyone asks, at most six: the event, the weekly order, Valio recipes for the season and from what the kitchen buys, low stock, a product",
    description:
      "Kinds: event (plan a menu, naming a Valio recipe that fits), weekly_due (the standing order closes soon), low_pantry, and seasonal: " +
      "an idea from Valio Aimo, which the buyer's agent only shows to a person. topic tells seasonal ones apart: season (a Valio recipe for the season), " +
      "usual (a Valio recipe that uses what the kitchen buys) and new_product. action.type is plan_menu, open_recipe, add_to_order, start_weekly or ask; " +
      "recipe carries the Valio recipe and its attribution.",
    parameters: [buyerQuery], response: "SuggestionList", errors: [400, 401, 403] },
];
