import type { Mandate, MenuOption, MenuPlan, MenuPlanRequest, Order, PantryItem, PreviousMenu, Product } from "@/lib/contracts";
import { addDays, helsinkiDate } from "@/lib/agent/dates";
import type { Catalog } from "@/lib/catalog/types";
import { dateTime, day } from "@/lib/offers/format";
import { confirmedNetInWeek } from "@/lib/policy/week";
import { PLANNER_RECIPES, RECIPES, ROLES, summaryOf, type ProductWords } from "@/lib/recipes";
import type { UpstreamClient } from "@/lib/valio/types";
import { adaptRecipe, type AdaptedDish, type Adaptation } from "./adapt";
import { menuChanges, type NeedAmounts } from "./changes";
import { dietRules, wordsSafe, type DietRules } from "./dietary";
import { plannedEvent, type PlannedEvent, type WordsReader } from "./event";
import { menuFits } from "./fits";
import { candidatesFor, marketFor } from "./products";
import { BUFFET_MAIN_SHARE, chooseDishes, occasionsFor, portionShare, STRUCTURES, type CostedDish, type MenuKind } from "./select";
import { lineWarning, needsOf, shoppingLine, stockLeft, type Need, type PricedLine, type ShoppingContext } from "./shopping";
import { WASTE_FACTOR } from "./scale";
import { understoodSentence } from "./understood";

export interface PlanDeps {
  catalog: Pick<Catalog, "search">;
  upstream: UpstreamClient;
  /** The calling agent's buyer's mandate in force. */
  mandate: Mandate;
  /** This workspace's orders: stock they hold, and this week's confirmed spend. */
  orders: Order[];
  pantry: PantryItem[];
  now: Date;
  /** Reads free words into the event when a model is configured; the rules read them otherwise. */
  readWords?: WordsReader;
}

const KINDS: MenuKind[] = ["buffet", "two_course", "three_course"];
const TIERS = ["good", "better", "best"] as const;
const MAX_LINE_WARNINGS = 4;
/** Words in the sentence that names lines with no product, leaving room for "and more". */
const MAX_WORDS = 12;
const PREVIOUS_GONE = "Your earlier menu no longer fits. Changes compare with it anyway.";
const PREVIOUS_UNKNOWN = "That earlier menu id is unknown, so no changes are shown.";

const NAMES: Record<MenuKind, (meal: string) => { name: string; tagline: string }> = {
  buffet: () => ({ name: "Buffet", tagline: "Two warm dishes and a side. Guests help themselves." }),
  two_course: (meal) => ({ name: `Two-course ${meal}`, tagline: "A main with a side, then dessert." }),
  three_course: (meal) => ({ name: `Three-course ${meal}`, tagline: "Starter, a main with a side, and dessert." }),
};

/**
 * The menu id names its kind and its dishes by their place in the library, so a later plan can compare against it and
 * the id stays short enough to travel with a basket: "menu:three_course:1.8.20.22".
 */
function menuId(kind: MenuKind, dishes: AdaptedDish[]): string {
  return `menu:${kind}:${dishes.map((dish) => RECIPES.indexOf(dish.def)).join(".")}`;
}

function decodeMenuId(id: string): { kind: MenuKind; recipeIds: string[] } | undefined {
  const match = id.match(/^menu:(buffet|two_course|three_course):(\d+(?:\.\d+)*)$/);
  if (!match) return undefined;
  const recipes = match[2].split(".").map((at) => RECIPES[Number(at)]);
  return recipes.every(Boolean) ? { kind: match[1] as MenuKind, recipeIds: recipes.map((recipe) => recipe.id) } : undefined;
}

/**
 * Delivery the day before the event, unless that day has already come: then the day itself. The plan returns it as
 * `deliverBy`, and every order made from the plan uses it, so the plan and the order never disagree.
 */
export function deliveryDate(eventDate: string, today: string): string {
  const before = addDays(eventDate, -1);
  return before > today ? before : eventDate;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Memoised catalogue look-up: each set of words is searched once per plan. */
function finder(catalog: PlanDeps["catalog"], rules: DietRules): (spec: ProductWords) => Product[] {
  const cache = new Map<string, Product[]>();
  return (spec) => {
    const key = `${spec.words}|${spec.claims?.join(",") ?? ""}|${spec.nameHas?.join(",") ?? ""}`;
    let found = cache.get(key);
    if (!found) {
      found = candidatesFor(spec, catalog, rules);
      cache.set(key, found);
    }
    return found;
  };
}

/** Every product a plan may use: each ingredient as fitted, and each safe stand-in for its role. */
function productIds(dishes: AdaptedDish[], rules: DietRules, find: (spec: ProductWords) => Product[]): string[] {
  const specs = dishes.flatMap((dish) =>
    dish.items.flatMap((item) => [item.spec, ...ROLES[item.role].swaps.filter((swap) => wordsSafe(swap, rules))]),
  );
  return specs.flatMap((spec) => find(spec).map((product) => product.id));
}

/**
 * Cost per portion at this event's size, and how many lines cannot be met in full and on time, worked out the way the
 * menu's own shopping list is: the kitchen's stock and the role swaps count.
 */
function costed(dish: AdaptedDish, guests: number, shopping: Omit<ShoppingContext, "stock">, pantry: PantryItem[]): CostedDish {
  const lines = needsOf([dish], guests).map((need) => shoppingLine(need, { ...shopping, stock: stockLeft(pantry) }));
  const food = lines.reduce((sum, { foodNet }) => sum + foodNet, 0);
  return { dish, costPerPortion: food / guests, unavailable: lines.filter(({ line }) => line.availability !== "ok").length };
}

function needAmounts(needs: Need[]): NeedAmounts {
  return new Map(needs.map((need) => [need.original, need.quantity]));
}

interface Built {
  kind: MenuKind;
  option: Omit<MenuOption, "tier">;
}

interface OptionContext {
  event: PlannedEvent & { guests: number };
  deps: PlanDeps;
  rules: DietRules;
  shopping: Omit<ShoppingContext, "stock">;
  deliverBy: string;
  weekLeft: number;
  today: string;
  leftOut: { def: AdaptedDish["def"]; reason: string }[];
  previous?: { menu: PreviousMenu; needs: NeedAmounts };
}

function cutoffWarning(lines: PricedLine[], now: Date): string | undefined {
  const times = lines
    .filter(({ line, picked }) => line.toOrder.amount > 0 && line.availability === "ok" && picked?.orderBy && Date.parse(picked.orderBy) > now.getTime())
    .map(({ picked }) => picked!.orderBy!)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return times[0] ? `Order by ${dateTime(times[0])} to get it in time.` : undefined;
}

/** "1,000 kg Valio Eila® maitojuomaa 3%" -> "maitojuomaa 3%"; the English words when the line has them. */
function shortName(line: { asWritten: string; words?: string }): string {
  if (line.words) return line.words;
  return line.asWritten
    .replace(/^[\d,.]+ kg /, "")
    .replace(/valio |keittiön |eila® |®|™/gi, "")
    .split(",")[0]
    .trim();
}

/** Two short sentences: how many lines have no product, then as many of their names as fit in 14 words. */
function separateWarning(names: string[]): string[] {
  const count = names.length === 1 ? "1 line has no product here. It is not in the cost." : `${names.length} lines have no product here. They are not in the cost.`;
  const shown: string[] = [];
  for (const name of names) {
    if (`Buy separately: ${[...shown, name].join(", ")}.`.split(/\s+/).length > MAX_WORDS) break;
    shown.push(name);
  }
  return shown.length ? [count, `Buy separately: ${shown.join(", ")}${shown.length < names.length ? " and more" : ""}.`] : [count];
}

/** The lines the menu's recipes need that have no product here, by name, each once. */
function separateNames(chosen: CostedDish[]): string[] {
  return [...new Set(chosen.flatMap((entry) => (entry.dish.def.unlisted ?? []).filter((line) => !line.basic).map(shortName)))];
}

/** Items the cost leaves out: lines with no product or no price, and lines with no product here at all. */
function unpricedCount(chosen: CostedDish[], lines: PricedLine[]): number {
  return lines.filter((entry) => entry.unpriced).length + separateNames(chosen).length;
}

const NO_MAIN = "No main course fits your rules.";

function warningsFor(kind: MenuKind, chosen: CostedDish[], lines: PricedLine[], ctx: OptionContext): string[] {
  const warnings: string[] = [];
  const cutoff = cutoffWarning(lines, ctx.deps.now);
  if (cutoff) warnings.push(cutoff);
  const problems = lines.flatMap(({ line, picked }) => lineWarning(line, ctx.deliverBy, picked?.problem) ?? []);
  warnings.push(...problems.slice(0, MAX_LINE_WARNINGS));
  const more = problems.length - MAX_LINE_WARNINGS;
  if (more > 0) warnings.push(`${more} more ${more === 1 ? "item" : "items"} cannot arrive in full.`);
  if (problems.length && ctx.event.date <= addDays(ctx.today, 1)) warnings.push("The event is very soon. Some items cannot arrive in time.");
  const unpriced = lines.filter((entry) => entry.unpriced).map(({ line }) => line.words);
  if (unpriced.length) warnings.push(`No price for ${unpriced.slice(0, 3).join(", ")}. The cost leaves ${unpriced.length === 1 ? "it" : "them"} out.`);
  const separate = separateNames(chosen);
  if (separate.length) warnings.push(...separateWarning(separate));
  const swaps = lines.filter(({ line }) => line.swap).length;
  if (swaps) warnings.push(`${swaps} ${swaps === 1 ? "line uses a swap" : "lines use a swap"}. Read the reasons.`);
  const occasions = occasionsFor(ctx.event.occasion);
  for (const course of new Set(STRUCTURES[kind])) {
    if (!chosen.some((entry) => entry.dish.def.course === course)) warnings.push(`No safe ${course} was found for these needs.`);
    const dropped = ctx.leftOut.find(({ def }) => def.course === course && def.occasions.some((meal) => occasions.includes(meal)));
    if (dropped) warnings.push(`${dropped.def.name} left out. ${dropped.reason}`);
  }
  return warnings;
}

function buildOption(kind: MenuKind, chosen: CostedDish[], ctx: OptionContext): Built {
  const dishes = chosen.map((entry) => entry.dish);
  const needs = needsOf(dishes, ctx.event.guests, (dish) => portionShare(kind, dish.def.course));
  const shopping = { ...ctx.shopping, stock: stockLeft(ctx.deps.pantry) };
  const lines = needs.map((need) => shoppingLine(need, shopping));
  const toOrderNet = round2(lines.reduce((sum, { line }) => sum + (line.estNet ?? 0), 0));
  const totalNet = round2(lines.reduce((sum, { foodNet }) => sum + foodNet, 0));
  const costPerGuest = round2(totalNet / ctx.event.guests);
  const meal = ctx.event.occasion === "lunch" || ctx.event.occasion === "school lunch" ? "lunch" : "dinner";
  const fits = menuFits({
    needs: ctx.event.dietary,
    rules: ctx.rules,
    mandate: ctx.deps.mandate,
    dishes,
    lines,
    toOrderNet,
    weekLeft: ctx.weekLeft,
    deliverBy: ctx.deliverBy,
    budgetPerGuest: ctx.event.budgetPerGuest,
    costPerGuest,
    separate: separateNames(chosen).length,
  });
  if (!dishes.some((dish) => dish.def.course === "main")) fits.unshift({ ok: false, sentence: NO_MAIN });
  const unpriced = unpricedCount(chosen, lines);
  const changes = ctx.previous
    ? menuChanges(ctx.previous.needs, needAmounts(needs), ctx.previous.menu.guests, ctx.event.guests)
    : undefined;
  return {
    kind,
    option: {
      id: menuId(kind, dishes),
      ...NAMES[kind](meal),
      courses: dishes.map((dish) => ({ course: dish.def.course, recipe: dish.summary })),
      costPerGuest,
      totalNet,
      toOrderNet,
      ...(unpriced ? { unpriced, costNote: `The cost leaves out ${unpriced} ${unpriced === 1 ? "item" : "items"} we could not price.` } : {}),
      fits,
      shoppingList: lines.map(({ line }) => line),
      warnings: warningsFor(kind, chosen, lines, ctx),
      ...(changes ? { changes } : {}),
    },
  };
}

function planNotes(event: PlannedEvent, deliverBy: string, pantry: PantryItem[]): string[] {
  const notes = [...event.notes];
  notes.push("Prices are indicative net prices. You get signed prices when you order.");
  notes.push(`Amounts include ${Math.round(WASTE_FACTOR * 100)} % for waste, rounded up.`);
  notes.push(deliverBy < event.date ? `Delivery by ${day(deliverBy)}, the day before.` : `Delivery by ${day(deliverBy)}, the day itself.`);
  if (pantry.length) notes.push("Your stock is taken off the order. The stock list is demo data.");
  notes.push(`On the buffet each warm dish is ${BUFFET_MAIN_SHARE} of a portion.`);
  notes.push("Recipes: Valio (valioaimo.fi), scaled to your guests. Salt, spices and water are not on the list.");
  if (event.courses === 3) notes.push("You asked for three courses: see the three-course menu.");
  if (event.courses === 2) notes.push("You asked for two courses: see the two-course menu.");
  return notes;
}

/** The previous menu's dishes, fitted to today's rules, when its id is one this planner made and every dish still fits. */
function previousDishes(previous: PreviousMenu | undefined, eligible: Map<string, CostedDish>): { kind: MenuKind; dishes: CostedDish[] } | undefined {
  const decoded = previous ? decodeMenuId(previous.menuId) : undefined;
  if (!decoded) return undefined;
  const dishes = decoded.recipeIds.map((id) => eligible.get(id));
  return dishes.every((dish): dish is CostedDish => dish !== undefined) ? { kind: decoded.kind, dishes } : undefined;
}

/** What the previous menu needed for its guests, from its recipes as written when they no longer fit. */
function previousNeeds(previous: PreviousMenu, adapted: Map<string, Adaptation>): NeedAmounts | undefined {
  const decoded = decodeMenuId(previous.menuId);
  if (!decoded) return undefined;
  const dishes = decoded.recipeIds.flatMap((id): AdaptedDish[] => {
    const entry = adapted.get(id);
    if (!entry) return [];
    if (entry.ok) return [entry.dish];
    const items = entry.def.ingredients.map((ingredient) => ({ original: ingredient.words, spec: ingredient, amount: ingredient.amount, unit: ingredient.unit, role: ingredient.role }));
    return [{ def: entry.def, items, summary: summaryOf(entry.def) }];
  });
  return dishes.length ? needAmounts(needsOf(dishes, previous.guests, (dish) => portionShare(decoded.kind, dish.def.course))) : undefined;
}

/** Without a guest count nothing can be scaled: the plan says what it read and asks, instead of failing. */
function askForGuests(event: PlannedEvent): MenuPlan {
  return {
    understood: understoodSentence(event, event.courses),
    event: { date: event.date, occasion: event.occasion, dietary: event.dietary },
    needs: ["guests"],
    question: "How many guests?",
    menus: [],
    notes: event.notes,
  };
}

function previousNote(previous: PreviousMenu | undefined, read: boolean, kept: boolean): string[] {
  if (!previous || kept) return [];
  return [read ? PREVIOUS_GONE : PREVIOUS_UNKNOWN];
}

/**
 * Need -> recipe -> order: three menus (good, better, best by cost per guest) from the recipe library, each fitted to
 * the buyer's mandate and the event's dietary needs by recipe-role swaps, scaled to the guests, priced at indicative
 * net prices for the delivery date, with a shopping list net of the kitchen's stock and checked facts.
 */
export async function planMenu(request: MenuPlanRequest, deps: PlanDeps): Promise<MenuPlan> {
  const today = helsinkiDate(deps.now);
  const event = await plannedEvent(request, today, deps.readWords);
  if (!event.guests) return askForGuests(event);
  const guests = event.guests;
  const rules = dietRules(event.dietary, deps.mandate);
  const deliverBy = deliveryDate(event.date, today);
  const adapted = PLANNER_RECIPES.filter((def) => def.course !== "drink").map((def) => adaptRecipe(def, rules, event.dietary));
  const eligible = adapted.flatMap((entry) => (entry.ok ? [entry.dish] : []));
  const leftOut = adapted.flatMap((entry) => (entry.ok ? [] : [{ def: entry.def, reason: entry.reason }]));
  const find = finder(deps.catalog, rules);
  const findAny = finder(deps.catalog, { ...rules, excluded: [], excludedTraces: [] });
  const market = await marketFor(productIds(eligible, rules, find), deliverBy, {
    upstream: deps.upstream,
    customerNumber: deps.mandate.buyer.customerNumber,
    orders: deps.orders,
    now: deps.now,
  });
  const shopping = { market, rules, find, findAny };
  const costedDishes = eligible.map((dish) => costed(dish, guests, shopping, deps.pantry));
  const chosen = chooseDishes(costedDishes, KINDS, event.occasion);
  const previousMenu = "previous" in request ? request.previous : undefined;
  const previous = previousDishes(previousMenu, new Map(costedDishes.map((entry) => [entry.dish.def.id, entry])));
  if (previous) chosen.set(previous.kind, previous.dishes);
  const before = previousMenu ? previousNeeds(previousMenu, new Map(adapted.map((entry) => [entry.ok ? entry.dish.def.id : entry.def.id, entry]))) : undefined;
  const buyerOrders = deps.orders.filter((order) => order.buyer.id === deps.mandate.buyer.id);
  const ctx: OptionContext = {
    event: { ...event, guests },
    deps,
    rules,
    shopping,
    deliverBy,
    weekLeft: deps.mandate.limits.perWeek.amount - confirmedNetInWeek(buyerOrders, deps.now),
    today,
    leftOut,
    previous: before && previousMenu ? { menu: previousMenu, needs: before } : undefined,
  };
  const built = KINDS.map((kind) => buildOption(kind, chosen.get(kind) ?? [], ctx));
  // A menu without a main is incomplete: it goes last, whatever it costs, so it is never the cheapest "good" one.
  const incomplete = (entry: Built) => Number(!entry.option.courses.some((course) => course.course === "main"));
  const menus = built
    .sort((a, b) => incomplete(a) - incomplete(b) || a.option.costPerGuest - b.option.costPerGuest || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
    .map(({ option }, at) => ({ ...option, tier: TIERS[at] }));
  return {
    understood: understoodSentence(event, event.courses),
    event: { guests: event.guests, date: event.date, occasion: event.occasion, dietary: event.dietary },
    menus,
    notes: [...planNotes(event, deliverBy, deps.pantry), ...previousNote(previousMenu, Boolean(before), Boolean(previous))],
    deliverBy,
  };
}
