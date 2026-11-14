import { day } from "@/lib/console/format/time";
import type {
  Amount,
  BasketLineRequest,
  Course,
  MenuOption,
  MenuPlan,
  PlanDetails,
  PlanRequest,
  Recipe,
  RecipeSummary,
  ShoppingLine,
  Suggestion,
  Tier,
  BasketUnit,
} from "./types";

const NUMBER = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const MONEY = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: 2 });
const WHOLE_MONEY = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Good, better, best in a cook's words. */
export const TIER_WORD: Record<Tier, string> = { good: "Simple", better: "Classic", best: "Special" };

export const COURSE_WORD: Record<Course, string> = {
  starter: "Starter",
  main: "Main",
  side: "Side",
  dessert: "Dessert",
  drink: "Drink",
};

const COURSE_ORDER: Course[] = ["starter", "main", "side", "dessert", "drink"];

/** 12.4 -> "€12.40" */
export function money(amount: number): string {
  return MONEY.format(amount);
}

/** 1043.6 -> "€1,044" for totals read at a glance. */
export function wholeMoney(amount: number): string {
  return WHOLE_MONEY.format(amount);
}

/** { 12, "kg" } -> "12 kg" */
export function amountText(value: Amount): string {
  return `${NUMBER.format(value.amount)} ${value.unit}`;
}

/** The amounts a basket line takes: litres, kilograms or pieces. */
export function basketQuantity(value: Amount): { amount: number; unit: BasketUnit } {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  switch (value.unit) {
    case "kg":
    case "l":
    case "pcs":
      return { amount: round(value.amount), unit: value.unit };
    case "g":
      return { amount: round(value.amount / 1000), unit: "kg" };
    case "ml":
      return { amount: round(value.amount / 1000), unit: "l" };
    case "dl":
      return { amount: round(value.amount / 10), unit: "l" };
    default:
      return { amount: round(value.amount), unit: "pcs" };
  }
}

/** A line's swap choice: undecided lines take the agent's swap, a refused one keeps the recipe's own item. */
export type SwapChoice = "accepted" | "refused";

export function usesSwap(line: ShoppingLine, choice: SwapChoice | undefined): boolean {
  return Boolean(line.swap) && choice !== "refused";
}

/** The planner's swap that drops an ingredient instead of replacing it. */
export function isLeaveOut(words: string): boolean {
  return /^leave (it|them) out$/i.test(words.trim());
}

/** The lines to order for one menu: only what the kitchen does not already have. */
export function basketLines(option: MenuOption, choices: Record<string, SwapChoice> = {}): BasketLineRequest[] {
  return option.shoppingList
    .filter((line) => line.toOrder.amount > 0 && !(line.swap && isLeaveOut(line.swap.words) && usesSwap(line, choices[line.words])))
    .map((line) => {
      const swapped = usesSwap(line, choices[line.words]);
      const request: BasketLineRequest = {
        words: swapped && line.swap ? line.swap.words : line.words,
        quantity: basketQuantity(line.toOrder),
      };
      // The planner priced its product for the swap; a refused swap is searched afresh.
      if (line.product && (!line.swap || swapped)) request.productId = line.product.id;
      return request;
    });
}

const HELSINKI_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" });

/** The calendar day in Helsinki, as "YYYY-MM-DD". */
export function isoDay(ms: number): string {
  return HELSINKI_DATE.format(new Date(ms));
}

export function addDays(date: string, days: number): string {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * When the goods must arrive: the plan's own delivery day. A plan from before it carried one gets the planner's rule:
 * the day before the event, or the event day itself when the day before is today or past.
 */
export function deliverByFor(plan: Pick<MenuPlan, "event" | "deliverBy">, today: string): string {
  if (plan.deliverBy) return plan.deliverBy;
  const dayBefore = addDays(plan.event.date, -1);
  return dayBefore > today ? dayBefore : plan.event.date;
}

export function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** "Wedding dinner, Sat 21 Nov, 80 guests" */
export function basketTitle(plan: Pick<MenuPlan, "event">): string {
  const { occasion, date, guests } = plan.event;
  return `${capitalise(occasion?.trim() || "Event")}, ${day(date)}, ${guests} guests`;
}

/** "Milk, gluten" or a plain "No common allergens." */
export function allergenText(allergens: string[]): string {
  if (allergens.length === 0) return "No common allergens";
  return capitalise(allergens.map((a) => a.toLowerCase()).join(", "));
}

export const AVAILABILITY_WORD: Record<ShoppingLine["availability"], string> = {
  ok: "Arrives in time",
  short: "Only part in time",
  missing: "Not in time",
};

/** Which course each ingredient belongs to, read from the menu's recipes. Shared items go to the first course. */
export function courseIndex(recipes: Pick<Recipe, "course" | "ingredients">[]): Map<string, Course> {
  const index = new Map<string, Course>();
  const sorted = [...recipes].sort((a, b) => COURSE_ORDER.indexOf(a.course) - COURSE_ORDER.indexOf(b.course));
  for (const recipe of sorted) {
    for (const ingredient of recipe.ingredients) {
      const key = ingredient.words.toLowerCase();
      if (!index.has(key)) index.set(key, recipe.course);
    }
  }
  return index;
}

/** Lines grouped by course in menu order. Without a course index, or for an unknown line, "Other". */
export function groupLines(lines: ShoppingLine[], courses: Map<string, Course> = new Map()): { label: string; lines: ShoppingLine[] }[] {
  const groups = new Map<string, ShoppingLine[]>();
  for (const line of lines) {
    const course = courses.get(line.words.toLowerCase());
    const label = course ? COURSE_WORD[course] : courses.size ? "Other" : "Everything";
    groups.set(label, [...(groups.get(label) ?? []), line]);
  }
  const rank = (label: string) => {
    const index = COURSE_ORDER.findIndex((course) => COURSE_WORD[course] === label);
    return index === -1 ? COURSE_ORDER.length : index;
  };
  // Inside a course, what to order comes first; what the kitchen already has sinks to the end.
  const toOrderFirst = (a: ShoppingLine, b: ShoppingLine) => Number(b.toOrder.amount > 0) - Number(a.toOrder.amount > 0);
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([label, group]) => ({ label, lines: [...group].sort(toOrderFirst) }));
}

/** Courses in the order they are served. */
export function servedOrder(courses: MenuOption["courses"]): MenuOption["courses"] {
  return [...courses].sort((a, b) => COURSE_ORDER.indexOf(a.course) - COURSE_ORDER.indexOf(b.course));
}

/** An ingredient amount for a different number of portions, rounded to what a cook weighs. */
export function scaleAmount(amount: number, serves: number, portions: number): number {
  if (serves <= 0) return amount;
  const scaled = (amount * portions) / serves;
  if (scaled >= 100) return Math.round(scaled);
  if (scaled >= 10) return Math.round(scaled * 10) / 10;
  return Math.round(scaled * 100) / 100;
}

/** A recipe's course: its own field when the list sends one, or a course word among its labels. */
export function courseOf(recipe: Pick<RecipeSummary, "labels"> & { course?: Course }): Course | undefined {
  if (recipe.course) return recipe.course;
  return COURSE_ORDER.find((course) => recipe.labels.some((label) => label.toLowerCase() === course));
}

/** One recipe as basket lines for a number of portions. */
export function recipeLines(recipe: Pick<Recipe, "ingredients" | "serves">, portions: number): BasketLineRequest[] {
  return recipe.ingredients.map((ingredient) => ({
    words: ingredient.words,
    quantity: basketQuantity({ amount: scaleAmount(ingredient.amount, recipe.serves, portions), unit: ingredient.unit }),
  }));
}

/** How many lines a re-plan changed, when the planner sends no sentence of its own. */
export function changesText(option: Pick<MenuOption, "changes">, guests: number, previousGuests: number): string | undefined {
  if (option.changes?.sentence) return option.changes.sentence;
  if (guests === previousGuests) return undefined;
  return `${guests} guests instead of ${previousGuests}.`;
}

/** The query string that opens the planner with a request already in it. */
export function planQuery(payload: unknown): string {
  const params = new URLSearchParams();
  if (typeof payload === "string") params.set("words", payload);
  else if (payload && typeof payload === "object") {
    const body = payload as Partial<PlanDetails> & { words?: unknown };
    if (typeof body.words === "string") params.set("words", body.words);
    else {
      if (typeof body.guests === "number") params.set("guests", String(body.guests));
      if (typeof body.date === "string") params.set("date", body.date);
      if (typeof body.occasion === "string") params.set("occasion", body.occasion);
      if (Array.isArray(body.dietary) && body.dietary.length) params.set("dietary", body.dietary.join(","));
      if (typeof body.budgetPerGuest === "number") params.set("budget", String(body.budgetPerGuest));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Reads the planner's query string back into a request, or nothing when it holds none. */
export function planFromQuery(params: Pick<URLSearchParams, "get">): PlanRequest | undefined {
  const words = params.get("words")?.trim();
  if (words) return { words };
  const guests = Number(params.get("guests"));
  const date = params.get("date");
  if (!Number.isFinite(guests) || guests <= 0 || !date) return undefined;
  const request: PlanDetails = { guests, date };
  const occasion = params.get("occasion");
  if (occasion) request.occasion = occasion;
  const dietary = params.get("dietary");
  if (dietary) request.dietary = dietary.split(",").filter(Boolean);
  const budget = Number(params.get("budget"));
  if (Number.isFinite(budget) && budget > 0) request.budgetPerGuest = budget;
  return request;
}

/** What a suggestion card does when pressed. */
export type SuggestionAction =
  | { kind: "start_weekly"; label: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "ask"; label: string; line: BasketLineRequest };

function askLine(payload: unknown): BasketLineRequest | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const body = payload as { words?: unknown; quantity?: Partial<Amount> };
  if (typeof body.words !== "string") return undefined;
  const amount = body.quantity?.amount;
  const unit = body.quantity?.unit;
  if (typeof amount !== "number" || typeof unit !== "string") return undefined;
  return { words: body.words, quantity: basketQuantity({ amount, unit }) };
}

/**
 * The one action a suggestion offers. A seasonal idea only opens: a new product needs the person's OK.
 */
export function suggestionAction(suggestion: Suggestion): SuggestionAction | undefined {
  const { type, payload } = suggestion.action;
  if (type === "open_recipe") {
    const url = (payload as { source?: { url?: unknown } } | undefined)?.source?.url;
    if (typeof url === "string") return { kind: "link", label: "See the recipe", href: url };
  }
  if (type === "add_to_order") {
    const product = (payload as { product?: { id?: unknown; name?: unknown } } | undefined)?.product;
    // One pack, as a line the person sends: a new product still waits for their OK in the basket.
    if (typeof product?.id === "string" && typeof product.name === "string") {
      return { kind: "ask", label: "Order 1 pack", line: { words: product.name, productId: product.id, quantity: { amount: 1, unit: "pcs" } } };
    }
  }
  if (suggestion.kind === "seasonal") return { kind: "link", label: "Look at it", href: `/buyer/plan${planQuery(payload)}` };
  if (type === "start_weekly") return { kind: "start_weekly", label: "Start the weekly order" };
  if (type === "plan_menu") return { kind: "link", label: "Plan the menu", href: `/buyer/plan${planQuery(payload)}` };
  if (type === "open_basket") {
    const id = (payload as { basketId?: unknown } | undefined)?.basketId;
    return { kind: "link", label: "Open it", href: typeof id === "string" ? `/buyer?basket=${encodeURIComponent(id)}` : "/buyer" };
  }
  const line = askLine(payload);
  if (line) return { kind: "ask", label: `Order ${amountText(line.quantity)}`, line };
  return undefined;
}
