import type { MenuPlan, Suggestion } from "@/lib/contracts";
import { recommendedMenu } from "@/lib/assistant/cards";
import { helsinkiDate } from "@/lib/agent/dates";
import { weeklyDraft, weeklyStarted } from "@/lib/basket";
import { catalog } from "@/lib/catalog";
import { planMenuFor } from "@/lib/menu/service";
import { RECIPES, recipeDef, type RecipeDef } from "@/lib/recipes";
import { now } from "@/lib/clock";
import { currentMandate } from "@/lib/mandate";
import { stockLines } from "@/lib/pantry";
import { store } from "@/lib/store";
import { eventSuggestion, lowPantrySuggestion, seasonalSuggestion, weeklyDueSuggestion, type CalendarEvent } from "./build";
import { demoCalendar } from "./calendar";
import { rankSuggestions } from "./rank";
import { seasonRecipe, usualRecipe } from "./recipes";
import { seasonalPick } from "./seasonal";

export { eventSuggestion, lowPantrySuggestion, seasonalSuggestion, weeklyDueSuggestion, type CalendarEvent } from "./build";
export { demoCalendar } from "./calendar";
export { MAX_SUGGESTIONS, rankSuggestions } from "./rank";
export { seasonalPick } from "./seasonal";
export { eventRecipe, seasonRecipe, usualRecipe } from "./recipes";

/**
 * The standing order's reminder from the basket engine's weekly draft, left out once this week's weekly basket was
 * started. When the draft cannot be read (a store without baskets, or the engine failing), the other suggestions still
 * come: this one is left out rather than failing them all.
 */
async function weeklyDue(buyerId: string, at: Date): Promise<Suggestion | undefined> {
  try {
    const baskets = await store().baskets.list();
    const draft = weeklyDraft(buyerId, baskets, at);
    return weeklyDueSuggestion({ ...draft, started: weeklyStarted(baskets, buyerId, draft.deliverBy) }, at);
  } catch {
    return undefined;
  }
}

/** How often the buyer ordered each product type, from its orders' lines. */
function boughtConcepts(lines: { productId: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const concept = catalog().get(line.productId)?.concept;
    if (concept) counts.set(concept, (counts.get(concept) ?? 0) + 1);
  }
  return counts;
}

/**
 * The Valio dish to name with an event, taken from the plan its "Plan the menu" action opens: the cake (or another
 * dessert) at a wedding or a birthday, else the main, of the menu that plan suggests. Undefined when that menu has none
 * from Valio, so the sentence never names a dish the plan does not serve.
 */
export function planDish(event: CalendarEvent, plan: MenuPlan): RecipeDef | undefined {
  const menu = recommendedMenu(plan, { ...event });
  if (!menu) return undefined;
  const course = /wedding|birthday/.test(event.occasion) ? "dessert" : "main";
  const served = menu.courses.filter((entry) => entry.course === course).map((entry) => recipeDef(entry.recipe.id));
  const valio = served.filter((def): def is RecipeDef => def?.source.name === "Valio");
  return valio.find((def) => course === "dessert" && /kakku|cake/i.test(`${def.name} ${def.nameFi ?? ""}`)) ?? valio[0];
}

/** Plans the event exactly as its action will, and names a dish from that plan; nothing when planning fails. */
async function forEvent(buyerId: string, event: CalendarEvent): Promise<RecipeDef | undefined> {
  const request = eventSuggestion(event).action.payload as { guests: number; date: string; occasion: string; dietary: string[] };
  try {
    return planDish(event, await planMenuFor(buyerId, request));
  } catch {
    return undefined;
  }
}

/**
 * What the buyer's agent proposes before anyone asks, from what the workspace holds for this buyer: its event, its
 * weekly order, a Valio recipe for the season and one from what it buys, low stock, a product. At most six.
 */
export async function suggestionsFor(buyerId: string): Promise<Suggestion[]> {
  const at = now();
  const today = helsinkiDate(at);
  const events = demoCalendar(buyerId, today);
  const [{ mandate }, orders, weekly, dishes] = await Promise.all([
    currentMandate(buyerId),
    store().orders.list(),
    weeklyDue(buyerId, at),
    Promise.all(events.map((event) => forEvent(buyerId, event))),
  ]);
  const lines = orders.filter((order) => order.buyer.id === buyerId).flatMap((order) => order.offer.lines);
  const bought = [...new Set(lines.map((line) => line.categoryGroup))];
  const month = Number(today.slice(5, 7));
  const seasonal = seasonalPick(catalog(), mandate, bought, month);
  return rankSuggestions([
    ...events.map((event, index) => eventSuggestion(event, dishes[index])),
    weekly,
    seasonRecipe(RECIPES, mandate, month),
    usualRecipe(RECIPES, mandate, boughtConcepts(lines), (id) => catalog().get(id)?.concept),
    lowPantrySuggestion(stockLines(buyerId)),
    seasonal ? seasonalSuggestion(seasonal.product, seasonal.label, seasonal.reason) : undefined,
  ]);
}
