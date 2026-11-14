import { describe, expect, it } from "vitest";
import { SuggestionList, type MenuPlanRequest, type Suggestion } from "@/lib/contracts";
import { recommendedMenu } from "@/lib/assistant/cards";
import { lower } from "@/lib/suggestions/recipes";
import { plan } from "../menu/support";
import { fixtureCatalog } from "@/lib/catalog";
import { BUYER_IDS, defaultMandate } from "@/lib/mandate";
import { stockLines } from "@/lib/pantry";
import {
  demoCalendar,
  eventSuggestion,
  lowPantrySuggestion,
  MAX_SUGGESTIONS,
  planDish,
  rankSuggestions,
  seasonalPick,
  seasonalSuggestion,
  seasonRecipe,
  usualRecipe,
  weeklyDueSuggestion,
} from "@/lib/suggestions";
import { RECIPES, recipeDef } from "@/lib/recipes";

const NOW = new Date("2026-11-14T09:00:00+02:00");
const TODAY = "2026-11-14";
const catalog = fixtureCatalog();
const words = (text: string) => text.split(/(?<=[.?!])\s+/).map((sentence) => sentence.split(/\s+/).length);

describe("suggestions", () => {
  it("reminds of the weekly order with its cut-off and the lines ready", () => {
    const draft = { deliverBy: "2026-11-16", cutoff: "2026-11-15T15:00:00.000Z", lines: Array.from({ length: 20 }) };
    expect(weeklyDueSuggestion(draft, NOW)).toEqual({
      id: "weekly_due:2026-11-16",
      kind: "weekly_due",
      headline: "Monday order",
      sentence: "Your Monday order closes Sunday 17:00. 20 lines are ready.",
      action: { type: "start_weekly" },
    });
    expect(weeklyDueSuggestion({ ...draft, cutoff: "2026-11-14T06:00:00.000Z" }, NOW)).toBeUndefined();
    // Once this week's weekly basket was started, there is nothing to remind of.
    expect(weeklyDueSuggestion({ ...draft, started: true }, NOW)).toBeUndefined();
  });

  it("names the stock line furthest below a week's use", () => {
    expect(lowPantrySuggestion(stockLines(BUYER_IDS.nordicHarbour))).toMatchObject({
      kind: "low_pantry",
      sentence: "Rice is low: 4 kg left for a week that needs 12.",
      action: { type: "ask", payload: { words: "rice", quantity: { amount: 8, unit: "kg" } } },
    });
    expect(lowPantrySuggestion([{ words: "sugar", amount: 5, unit: "kg", weeklyUse: 4 }])).toBeUndefined();
  });

  it("offers to plan the menu for the next booked event, with the planner's input", () => {
    const [event] = demoCalendar(BUYER_IDS.nordicHarbour, TODAY);
    expect(eventSuggestion(event)).toEqual({
      id: "event:2026-11-20:dinner",
      kind: "event",
      headline: "Fri 20 Nov: dinner",
      sentence: "Friday: dinner for 80. Plan the menu?",
      action: { type: "plan_menu", payload: { guests: 80, date: "2026-11-20", occasion: "dinner", dietary: ["nut_free"] } },
    });
  });

  it("lets Valio Aimo propose one seasonal product the kitchen's rules allow, for a person to decide", () => {
    const pick = seasonalPick(catalog, defaultMandate(BUYER_IDS.nordicHarbour), ["plant_based", "dairy"], 11)!;
    expect(pick.product.id).toBe("474957");
    const suggestion = seasonalSuggestion(pick.product, pick.label, pick.reason);
    expect(suggestion.sentence).toBe("Valio Aimo suggests gingerbread oat drink for Christmas coffee.");
    expect(suggestion.action).toMatchObject({ type: "add_to_order", payload: { from: "Valio Aimo", rule: "A person decides. Your agent never orders a proposal alone." } });
  });

  it("proposes nothing seasonal outside what the kitchen buys or its rules allow", () => {
    expect(seasonalPick(catalog, defaultMandate(BUYER_IDS.nordicHarbour), ["meat"], 11)?.product.categoryGroup).not.toBe("plant_based");
    const strict = { ...defaultMandate(BUYER_IDS.kaisla), categories: { allowed: ["meat"] } };
    expect(seasonalPick(catalog, strict, [], 11)).toBeUndefined();
  });

  it("ranks the event first and keeps at most six, each sentence at most 14 words", () => {
    const stock = stockLines(BUYER_IDS.nordicHarbour);
    const pick = seasonalPick(catalog, defaultMandate(BUYER_IDS.nordicHarbour), [], 11)!;
    const ranked = rankSuggestions([
      seasonalSuggestion(pick.product, pick.label, pick.reason),
      lowPantrySuggestion(stock),
      undefined,
      weeklyDueSuggestion({ deliverBy: "2026-11-16", cutoff: "2026-11-15T15:00:00.000Z", lines: [] }, NOW),
      ...demoCalendar(BUYER_IDS.laine, TODAY).map((event) => eventSuggestion(event)),
      ...demoCalendar(BUYER_IDS.kaisla, TODAY).map((event) => eventSuggestion(event)),
      seasonRecipe(RECIPES, defaultMandate(BUYER_IDS.nordicHarbour), 11),
      ...demoCalendar(BUYER_IDS.nordicHarbour, TODAY).map((event) => eventSuggestion(event)),
    ]);
    expect(ranked).toHaveLength(MAX_SUGGESTIONS);
    expect(ranked.map((suggestion: Suggestion) => suggestion.kind)).toEqual(["event", "event", "event", "weekly_due", "seasonal", "low_pantry"]);
    expect(SuggestionList.safeParse({ suggestions: ranked }).success).toBe(true);
    for (const suggestion of ranked) for (const count of words(suggestion.sentence)) expect(count).toBeLessThanOrEqual(14);
  });

  it("proposes a Valio Christmas recipe in November, safe under the kitchen's mandate, to open", () => {
    const suggestion = seasonRecipe(RECIPES, defaultMandate(BUYER_IDS.kaisla), 11)!;
    expect(suggestion).toMatchObject({ kind: "seasonal", topic: "season", headline: "Christmas idea from Valio", action: { type: "open_recipe" } });
    const def = recipeDef(suggestion.recipe!.id)!;
    expect(def.seasons).toContain("joulu");
    expect(suggestion.recipe!.source).toMatchObject({ name: "Valio", attribution: "Recipe: Valio" });
    for (const count of words(suggestion.sentence)) expect(count).toBeLessThanOrEqual(14);
    expect(seasonRecipe(RECIPES, defaultMandate(BUYER_IDS.kaisla), 11)).toEqual(suggestion);
  });

  it("proposes a Valio recipe that uses products the kitchen already buys", () => {
    const conceptOf = (id: string) => catalog.get(id)?.concept;
    const bought = new Map([["whipping_cream", 6], ["eggs", 4], ["sugar", 2]]);
    const suggestion = usualRecipe(RECIPES, defaultMandate(BUYER_IDS.nordicHarbour), bought, conceptOf)!;
    expect(suggestion).toMatchObject({ kind: "seasonal", topic: "usual", headline: "Uses what you buy", action: { type: "open_recipe" } });
    const def = recipeDef(suggestion.recipe!.id)!;
    expect(def.ingredients.filter((line) => bought.has(conceptOf(line.matched!.productId) ?? "")).length).toBeGreaterThanOrEqual(2);
    for (const count of words(suggestion.sentence)) expect(count).toBeLessThanOrEqual(14);
    expect(usualRecipe(RECIPES, defaultMandate(BUYER_IDS.nordicHarbour), new Map(), conceptOf)).toBeUndefined();
  });

  it("names a Valio recipe with the event when one fits", () => {
    const [event] = demoCalendar(BUYER_IDS.laine, TODAY);
    const cake = RECIPES.find((def) => def.source.name === "Valio" && def.plannable && /kakku/.test(def.nameFi ?? ""))!;
    const suggestion = eventSuggestion(event, cake);
    expect(suggestion.sentence).toMatch(/^Saturday: wedding for 60\. Valio's .+ fits\. Plan the menu\?$/);
    expect(suggestion.recipe?.source.name).toBe("Valio");
    for (const count of words(suggestion.sentence)) expect(count).toBeLessThanOrEqual(14);
  });
});

describe("the event suggestion names a dish of its own plan", () => {
  it.each([["laine", "dessert"], ["nordicHarbour", "main"], ["kaisla", "main"]] as const)("for %s it names the plan's %s", async (kitchen, course) => {
    const [event] = demoCalendar(BUYER_IDS[kitchen], TODAY);
    const suggestion = eventSuggestion(event);
    const planned = await plan(suggestion.action.payload as MenuPlanRequest, kitchen);
    const dish = planDish(event, planned);
    expect(dish, kitchen).toBeDefined();
    const suggested = recommendedMenu(planned, { ...event })!;
    const served = suggested.courses.filter((entry) => entry.course === course).map((entry) => entry.recipe.id);
    expect(served).toContain(dish!.id);
    expect(dish!.source.name).toBe("Valio");
    expect(eventSuggestion(event, dish).sentence).toContain(`Valio's ${lower(dish!.name)} fits.`);
  });
});
