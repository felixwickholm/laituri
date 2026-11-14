import type {
  AssistantAction,
  AssistantEventCard,
  AssistantMenuCard,
  AssistantRecipeCard,
  AssistantShoppingCard,
  CreateBasketRequest,
  MenuOption,
  MenuPlan,
  RecipeSummary,
} from "@/lib/contracts";
import { day } from "@/lib/offers/format";
import { basketQuantity, deliverByFor as planDeliverBy } from "@/lib/menu-console/format";
import { getRecipe, searchRecipes } from "@/lib/recipes";
import type { Choice } from "./rules";
import { recipeSource } from "./source";

export { recipeSource };
import type { EventSoFar } from "./state";

export const TIER_LABEL: Record<MenuOption["tier"], string> = { good: "Simple", better: "Classic", best: "Special" };

function fullRecipe(id: string): object | undefined {
  try {
    return getRecipe(id);
  } catch {
    return undefined;
  }
}

export function recipeCard(summary: RecipeSummary, why?: string): AssistantRecipeCard {
  const full = fullRecipe(summary.id);
  const source = full ? recipeSource(full) : undefined;
  return {
    kind: "recipe",
    id: summary.id,
    name: summary.name,
    course: summary.course,
    serves: summary.serves,
    ...(summary.minutes ? { minutes: summary.minutes } : {}),
    allergens: summary.allergens,
    labels: summary.labels,
    ...(why ? { why } : {}),
    ...(source ? { source } : {}),
  };
}

export function eventCard(plan: MenuPlan | undefined, event: EventSoFar, understood: string): AssistantEventCard {
  return {
    kind: "event",
    understood: plan?.understood ?? understood,
    ...(event.guests ? { guests: event.guests } : {}),
    ...(event.date ? { date: event.date } : {}),
    ...(event.occasion ? { occasion: event.occasion } : {}),
    dietary: event.dietary,
    ...(event.budgetPerGuest ? { budgetPerGuest: event.budgetPerGuest } : {}),
  };
}

const KIND_OF: Record<string, Choice> = { buffet: "buffet", two_course: "two_course", three_course: "three_course" };

export function kindOf(menuId: string): Choice | undefined {
  return KIND_OF[menuId.split(":")[1] ?? ""];
}

/** The menu a choice names, among the plan's three. */
export function menuFor(plan: MenuPlan, choice: Choice): MenuOption | undefined {
  return plan.menus.find((menu) => menu.tier === choice || kindOf(menu.id) === choice);
}

/** A menu with no main course is incomplete: it is never the one the assistant suggests. */
function complete(menu: MenuOption): boolean {
  return menu.courses.some((course) => course.course === "main");
}

/**
 * The menu the assistant recommends, among the complete ones: the course count asked for; a three-course dinner for a
 * wedding or a party; with a budget, the best menu (the fullest, so the most expensive) that keeps it; else the
 * middle one. Within a budget, the asked-for kind comes first when it keeps the budget.
 */
export function recommendedMenu(plan: MenuPlan, event: EventSoFar): MenuOption | undefined {
  const menus = plan.menus.filter(complete);
  if (!menus.length) return undefined;
  const byCourses = event.courses === 3 ? "three_course" : event.courses === 2 ? "two_course" : undefined;
  const festive = /wedding|party|birthday|celebration|christmas/i.test(event.occasion ?? "") ? "three_course" : undefined;
  const kind = byCourses ?? festive;
  const fitting = event.budgetPerGuest ? menus.filter((menu) => menu.costPerGuest <= event.budgetPerGuest!) : menus;
  const wanted = kind ? fitting.find((menu) => kindOf(menu.id) === kind) ?? menus.find((menu) => kindOf(menu.id) === kind) : undefined;
  return wanted ?? (event.budgetPerGuest ? fitting.at(-1) ?? menus[0] : menus.find((menu) => menu.tier === "better") ?? menus[0]);
}

function linesToOrder(option: MenuOption): MenuOption["shoppingList"] {
  return option.shoppingList.filter((line) => line.toOrder.amount > 0 && !(line.swap && /^leave (it|them) out$/i.test(line.swap.words.trim())));
}

export function menuCard(option: MenuOption, guests: number, flags: { recommended: boolean; chosen: boolean }): AssistantMenuCard {
  return {
    kind: "menu",
    id: option.id,
    tier: option.tier,
    label: TIER_LABEL[option.tier],
    name: option.name,
    tagline: option.tagline,
    ...flags,
    guests,
    courses: option.courses.map(({ course, recipe }) => {
      const full = fullRecipe(recipe.id);
      const source = full ? recipeSource(full) : undefined;
      return { course, recipeId: recipe.id, name: recipe.name, ...(source ? { source } : {}) };
    }),
    costPerGuest: option.costPerGuest,
    ...(option.costNote ? { costNote: option.costNote } : {}),
    totalNet: option.totalNet,
    toOrderNet: option.toOrderNet,
    linesToOrder: linesToOrder(option).length,
    fits: option.fits,
    warnings: option.warnings.slice(0, 2),
    ...(option.changes ? { changes: option.changes.sentence } : {}),
  };
}

/** The plan's own delivery day: the order asks for what the plan priced and checked. */
export function deliverByFor(plan: MenuPlan, today: string): string {
  return planDeliverBy(plan, today);
}

export function basketTitle(plan: MenuPlan): string {
  const occasion = plan.event.occasion?.trim() || "Event";
  return `${occasion[0].toUpperCase()}${occasion.slice(1)}, ${day(plan.event.date)}, ${plan.event.guests} guests`;
}

/** The chosen menu as a basket request: what the kitchen does not have yet, swaps taken, products the planner priced. */
export function basketFor(plan: MenuPlan, option: MenuOption, today: string): CreateBasketRequest {
  return {
    title: basketTitle(plan),
    deliverBy: deliverByFor(plan, today),
    source: "menu",
    menuId: option.id,
    lines: linesToOrder(option).map((line) => ({
      words: line.swap ? line.swap.words : line.words,
      // Kitchen amounts may come in grams, millilitres or decilitres: a basket takes kilograms and litres.
      quantity: basketQuantity(line.toOrder),
      ...(line.product ? { productId: line.product.id } : {}),
    })),
  };
}

export function shoppingCard(plan: MenuPlan, option: MenuOption, today: string): AssistantShoppingCard {
  return {
    kind: "shopping",
    menuId: option.id,
    title: option.name,
    deliverBy: deliverByFor(plan, today),
    toOrderNet: option.toOrderNet,
    lines: option.shoppingList.map((line) => ({
      words: line.words,
      ...(line.product ? { product: line.product.displayName } : {}),
      toOrder: line.toOrder,
      ...(line.inPantry ? { inPantry: line.inPantry } : {}),
      ...(line.estNet !== undefined ? { estNet: line.estNet } : {}),
      availability: line.availability,
      ...(line.swap ? { swap: `${line.swap.words}: ${line.swap.reason}` } : {}),
    })),
  };
}

export function orderAction(plan: MenuPlan, option: MenuOption, today: string, now?: boolean): AssistantAction {
  return {
    kind: "order_menu",
    menuId: option.id,
    label: `Order ${TIER_LABEL[option.tier].toLowerCase()} menu`,
    basket: basketFor(plan, option, today),
    ...(now ? { now: true } : {}),
  };
}

export function recipeAction(recipe: Pick<RecipeSummary, "id" | "name">): AssistantAction {
  return { kind: "open_recipe", recipeId: recipe.id, label: recipe.name, url: `/api/v1/recipes/${encodeURIComponent(recipe.id)}` };
}

/**
 * Recipes for a request, through the recipe library's own search (Valio's first, needs met as written): the
 * assistant's English words, then each word alone, then the kitchen's own longer words, the first that finds any.
 */
export function findRecipes(query: string, rawWords: string, dietary: string[], limit = 3): RecipeSummary[] {
  const english = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  const own = rawWords.toLowerCase().split(/[^\p{L}]+/u).filter((word) => word.length > 4);
  const tries = [english.join(" "), ...english, ...own].filter(Boolean);
  for (const words of [...new Set(tries)]) {
    const found = searchRecipes({ words, dietary, limit }).filter((recipe) => recipe.course !== "drink");
    if (found.length) return found;
  }
  return [];
}

/**
 * Proactive ideas before there is a menu: a starter, a main and a dessert for the occasion that meet the diets,
 * preferring dishes that use what the kitchen already has in stock, with the reason said.
 */
export function ideaCards(event: EventSoFar, pantryWords: string[], limit = 3): AssistantRecipeCard[] {
  const festive = /wedding|party|birthday|celebration|christmas/i.test(event.occasion ?? "");
  const courses = ["starter", "main", "dessert"] as const;
  return courses
    .flatMap((course) => {
      const found = searchRecipes({ occasion: event.occasion ?? "dinner", course, dietary: event.dietary, limit: 8 });
      const scored = found.map((summary) => {
        const recipe = fullRecipe(summary.id) as { ingredients?: { words: string }[] } | undefined;
        const stocked = pantryWords.filter((words) => recipe?.ingredients?.some((line) => line.words.toLowerCase().includes(words.toLowerCase())));
        return { summary, stocked };
      });
      const best = [...scored].sort((a, b) => b.stocked.length - a.stocked.length)[0];
      return best ? [best] : [];
    })
    .slice(0, limit)
    .map(({ summary, stocked }) => recipeCard(summary, stocked.length ? `You have ${stocked[0]}` : festive ? "For celebrations" : undefined));
}
