import { z } from "zod";
import { IsoDate } from "./common";

/** Kitchen amounts: litres or kilograms. */
export const KitchenUnit = z.enum(["l", "kg"]);
export type KitchenUnit = z.infer<typeof KitchenUnit>;

export const KitchenAmount = z.object({ amount: z.number().min(0), unit: KitchenUnit });
export type KitchenAmount = z.infer<typeof KitchenAmount>;

export const Course = z.enum(["starter", "main", "side", "dessert", "drink"]);
export type Course = z.infer<typeof Course>;

/** Meals a dish suits, besides its course. */
export const Occasion = z.enum(["dinner", "lunch", "buffet", "breakfast", "celebration"]);
export type Occasion = z.infer<typeof Occasion>;

/** Dietary needs the planner reads from words: each is a hard filter on every dish. */
export const DietaryNeed = z.enum([
  "nut_free",
  "peanut_free",
  "gluten_free",
  "lactose_free",
  "milk_free",
  "egg_free",
  "fish_free",
  "sesame_free",
  "soy_free",
  "vegetarian",
  "vegan",
]);
export type DietaryNeed = z.infer<typeof DietaryNeed>;

export const RecipeSource = z.object({
  name: z.string().describe("Valio, or Laituri for the team's own fallback recipes"),
  url: z.string().url().optional().describe("The recipe's page at the source"),
  attribution: z.string().describe("Show it with the recipe: \"Recipe: Valio\""),
});
export type RecipeSource = z.infer<typeof RecipeSource>;

export const RecipeSummary = z.object({
  id: z.string(),
  name: z.string().describe("English title; Valio's titles are translated by us"),
  nameFi: z.string().optional().describe("The source's Finnish title"),
  serves: z.number().int().describe("Portions the listed amounts make"),
  allergens: z.array(z.string()).describe("Derived from the ingredients, for example milk, gluten, egg"),
  labels: z.array(z.string()).describe("vegan, vegetarian, lactose_free, gluten_free where true"),
  minutes: z.number().int().optional().describe("Working time in minutes"),
  course: Course,
  source: RecipeSource.optional().describe("Always set: where the recipe comes from"),
  image: z.string().url().optional().describe("A link to the source's photo"),
  plannable: z.boolean().optional().describe("The menu planner can cost and order it: enough of its ingredients match catalogue products"),
  fallback: z.boolean().optional().describe("The team's own recipe, used when no Valio recipe fits"),
});
export type RecipeSummary = z.infer<typeof RecipeSummary>;

export const RecipeIngredient = z.object({
  words: z.string().describe("What to search the catalogue for"),
  amount: z.number().positive().describe("Amount for the recipe's portions"),
  unit: KitchenUnit,
  role: z.string().describe("The culinary role, which decides what may stand in"),
  purpose: z.string().describe("What the ingredient does, for example 'cooking cream: richness in the sauce'"),
  allergens: z.array(z.string()),
  asWritten: z.string().optional().describe("The line as the source writes it"),
  product: z.object({
    id: z.string(),
    name: z.string(),
    confidence: z.enum(["high", "medium", "low"]).describe("high: the same ingredient; medium: a close stand-in"),
  }).optional().describe("The catalogue product the import matched"),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredient>;

export const Recipe = RecipeSummary.extend({
  occasions: z.array(Occasion).describe("Events the dish suits; a celebration menu uses only dishes tagged celebration"),
  ingredients: z.array(RecipeIngredient),
  method: z.string().describe("One short line in our words; the full method is at source.url"),
  notOrdered: z.array(z.object({
    asWritten: z.string(),
    reason: z.string().describe("Kitchen basic, or not in the recorded catalogue: buy it separately"),
    allergens: z.array(z.string()),
  })).describe("Lines never put on a shopping list; they still count for allergens"),
  seasons: z.array(z.string()).optional().describe("Valio's season tags: joulu, talvi, syksy, kevät, kesä"),
});
export type Recipe = z.infer<typeof Recipe>;

export const RecipeList = z.object({ recipes: z.array(RecipeSummary) });

export const RecipeSearch = z.object({
  words: z.string().max(200).optional().describe("Words to find in titles, tags and ingredients, Finnish or English: \"cream cake\", \"lohi\""),
  occasion: z.string().max(80).optional().describe("wedding, Christmas party, buffet, lunch, breakfast, dinner"),
  course: Course.optional(),
  dietary: z.array(z.string().max(40)).max(12).optional().describe("Needs every recipe must meet: nut_free, gluten_free, vegan"),
  plannable: z.boolean().optional().describe("Only recipes the planner can cost and order"),
  limit: z.number().int().min(1).max(200).optional(),
});
export type RecipeSearch = z.infer<typeof RecipeSearch>;

export const MenuEvent = z.object({
  guests: z.number().int().min(1).max(2000).optional().describe("Absent when the words gave no guest count; needs then asks for it"),
  date: IsoDate,
  occasion: z.string().max(80).optional(),
  dietary: z.array(z.string()).describe("Dietary needs as read, for example nut_free, gluten_free"),
});
export type MenuEvent = z.infer<typeof MenuEvent>;

export const PreviousMenu = z.object({
  menuId: z.string().min(1).describe("The menu option id from an earlier plan"),
  guests: z.number().int().min(1).max(2000).describe("The guest count that menu was planned for"),
});
export type PreviousMenu = z.infer<typeof PreviousMenu>;

const StructuredPlan = z.object({
  guests: z.number().int().min(1).max(2000),
  date: IsoDate,
  occasion: z.string().max(80).optional(),
  dietary: z.array(z.string().max(40)).max(12).optional(),
  budgetPerGuest: z.number().positive().optional().describe("Net EUR per guest the kitchen wants to stay under"),
  previous: PreviousMenu.optional(),
});

const WordsPlan = z.object({
  words: z.string().trim().min(3).max(500).describe("The event in plain words, Finnish or English"),
  previous: PreviousMenu.optional(),
});

export const MenuPlanRequest = z.union([WordsPlan, StructuredPlan]);
export type MenuPlanRequest = z.infer<typeof MenuPlanRequest>;

export const LineAvailability = z.enum(["ok", "short", "missing"]);
export type LineAvailability = z.infer<typeof LineAvailability>;

export const ShoppingLine = z.object({
  words: z.string().describe("What the recipes need, in catalogue words"),
  quantity: KitchenAmount.describe("What the recipes need, waste included"),
  inPantry: KitchenAmount.optional().describe("What the kitchen already has"),
  toOrder: KitchenAmount,
  product: z.object({
    id: z.string(),
    name: z.string().describe("The catalogue name as the wholesaler writes it"),
    displayName: z.string().describe("The same name in sentence case, for people"),
  }).optional()
    .describe("The product to order; for swap.words when a swap is set"),
  estNet: z.number().optional().describe("Indicative net EUR for toOrder in whole packs; absent when the product has no price"),
  availability: LineAvailability.describe("For the delivery date: ok, short (part in stock) or missing"),
  swap: z.object({ words: z.string(), reason: z.string() }).optional()
    .describe("A recipe-role swap. Order swap.words instead of words"),
});
export type ShoppingLine = z.infer<typeof ShoppingLine>;

export const LineChange = z.object({ words: z.string(), from: KitchenAmount, to: KitchenAmount });
export type LineChange = z.infer<typeof LineChange>;

export const MenuChanges = z.object({
  sentence: z.string().describe("72 guests instead of 80: 9 lines get smaller."),
  lines: z.array(LineChange),
});
export type MenuChanges = z.infer<typeof MenuChanges>;

export const MenuCourse = z.object({ course: Course, recipe: RecipeSummary });

export const MenuOption = z.object({
  id: z.string().describe("Stable id: pass it as previous.menuId when the event changes"),
  tier: z.enum(["good", "better", "best"]),
  name: z.string(),
  tagline: z.string(),
  courses: z.array(MenuCourse),
  costPerGuest: z.number().describe("Food cost per guest, net EUR: every ingredient the menu uses, the kitchen's own stock included at the same indicative prices"),
  totalNet: z.number().describe("Food cost of the whole event, net EUR: costPerGuest times the guests"),
  toOrderNet: z.number().describe("What remains to order after the kitchen's stock, net EUR at indicative prices in whole packs"),
  unpriced: z.number().int().min(1).optional().describe("Items the menu needs that the cost leaves out: no product or no price. Absent when every item is priced"),
  costNote: z.string().optional().describe("Set with unpriced: say it with costPerGuest, which is then not the full food cost"),
  fits: z.array(z.object({ ok: z.boolean(), sentence: z.string() })),
  shoppingList: z.array(ShoppingLine),
  warnings: z.array(z.string()),
  changes: MenuChanges.optional().describe("Set when the request named a previous menu"),
});
export type MenuOption = z.infer<typeof MenuOption>;

export const MenuPlan = z.object({
  understood: z.string().describe("The request read back in one plain sentence"),
  event: MenuEvent,
  needs: z.array(z.literal("guests")).optional().describe("Set when the plan cannot start: what to ask the person. menus is then empty"),
  question: z.string().optional().describe("The plain question to ask when needs is set"),
  menus: z.array(MenuOption),
  notes: z.array(z.string()),
  deliverBy: IsoDate.optional().describe("The day the goods must arrive: the day before the event, or the day itself when that is today or past. An order for this plan uses it"),
});
export type MenuPlan = z.infer<typeof MenuPlan>;

export const PantryItem = z.object({ words: z.string(), amount: z.number().min(0), unit: KitchenUnit });
export type PantryItem = z.infer<typeof PantryItem>;

export const PantryList = z.object({ items: z.array(PantryItem) });

export const SuggestionKind = z.enum(["weekly_due", "event", "drift", "low_pantry", "seasonal"]);

/** Why a suggestion comes: the season, a booked event, what the kitchen buys, a new product, the weekly order, low stock. */
export const SuggestionTopic = z.enum(["season", "event", "usual", "new_product", "weekly", "stock"]);

export const Suggestion = z.object({
  id: z.string(),
  kind: SuggestionKind.describe("seasonal: an idea from Valio Aimo (a recipe or a product)"),
  topic: SuggestionTopic.optional(),
  headline: z.string(),
  sentence: z.string(),
  action: z.object({
    type: z.enum(["start_weekly", "plan_menu", "open_basket", "ask", "open_recipe", "add_to_order"]),
    payload: z.unknown().optional().describe(
      "plan_menu: the planner's structured request. open_recipe: { recipeId, source }. add_to_order: { product: { id, name }, quantity }: a person adds it, the agent never orders a proposal alone",
    ),
    label: z.string().optional().describe("The button's words: \"Plan the menu\", \"Open the recipe\", \"Add to order\""),
  }),
  recipe: z.object({ id: z.string(), name: z.string(), source: RecipeSource, image: z.string().url().optional() }).optional()
    .describe("The Valio recipe the suggestion is about; show its attribution"),
});
export type Suggestion = z.infer<typeof Suggestion>;

export const SuggestionList = z.object({ suggestions: z.array(Suggestion).max(6) });
