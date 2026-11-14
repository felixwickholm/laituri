import type { DietaryNeed, Product, Suggestion } from "@/lib/contracts";
import { helsinkiDate, shortDay } from "@/lib/agent/dates";
import { clockTime, count, weekday } from "@/lib/offers/format";
import type { StockLine } from "@/lib/pantry";
import type { RecipeDef } from "@/lib/recipes";
import { lower } from "./recipes";

/** A booked event in the kitchen's calendar. */
export interface CalendarEvent {
  date: string;
  guests: number;
  occasion: string;
  dietary: DietaryNeed[];
}

/** Stock below this share of a week's use counts as low. */
const LOW_SHARE = 0.5;

/** "Your Monday order closes Sunday 17:00. 20 lines are ready." Nothing once the cut-off passed or the order was started. */
export function weeklyDueSuggestion(draft: { deliverBy: string; cutoff: string; lines: unknown[]; started?: boolean }, now: Date): Suggestion | undefined {
  if (draft.started || Date.parse(draft.cutoff) <= now.getTime()) return undefined;
  const closes = `${weekday(helsinkiDate(new Date(draft.cutoff)))} ${clockTime(draft.cutoff)}`;
  const ready = draft.lines.length ? ` ${count(draft.lines.length)} lines are ready.` : "";
  return {
    id: `weekly_due:${draft.deliverBy}`,
    kind: "weekly_due",
    headline: `${weekday(draft.deliverBy)} order`,
    sentence: `Your ${weekday(draft.deliverBy)} order closes ${closes}.${ready}`,
    action: { type: "start_weekly" },
  };
}

/** The stock line furthest below a week's use: "Rice is low: 4 kg left for a week that needs 12." */
export function lowPantrySuggestion(stock: StockLine[]): Suggestion | undefined {
  const low = stock
    .filter((line) => line.weeklyUse > 0 && line.amount < line.weeklyUse * LOW_SHARE)
    .sort((a, b) => a.amount / a.weeklyUse - b.amount / b.weeklyUse)[0];
  if (!low) return undefined;
  const name = low.words.charAt(0).toUpperCase() + low.words.slice(1);
  const verb = /s$/.test(low.words) ? "are" : "is";
  return {
    id: `low_pantry:${low.words}`,
    kind: "low_pantry",
    headline: `${name} ${verb} low`,
    sentence: `${name} ${verb} low: ${count(low.amount)} ${low.unit} left for a week that needs ${count(low.weeklyUse)}.`,
    action: { type: "ask", payload: { words: low.words, quantity: { amount: low.weeklyUse - low.amount, unit: low.unit } } },
  };
}

/**
 * "Friday: dinner for 80. Plan the menu?" with the event as the planner's structured input. With a Valio recipe that
 * suits the event, the sentence names it: "Saturday: wedding for 60. Valio's toffee layer cake fits. Plan the menu?"
 */
export function eventSuggestion(event: CalendarEvent, recipe?: RecipeDef): Suggestion {
  const day = weekday(event.date);
  const idea = recipe ? ` Valio's ${lower(recipe.name)} fits.` : "";
  return {
    id: `event:${event.date}:${event.occasion}`,
    kind: "event",
    ...(recipe ? { topic: "event" as const } : {}),
    headline: `${shortDay(event.date)}: ${event.occasion}`,
    sentence: `${day}: ${event.occasion} for ${event.guests}.${idea} Plan the menu?`,
    action: {
      type: "plan_menu",
      ...(recipe ? { label: "Plan the menu" } : {}),
      payload: { guests: event.guests, date: event.date, occasion: event.occasion, dietary: event.dietary },
    },
    ...(recipe ? { recipe: { id: recipe.id, name: recipe.name, source: recipe.source, ...(recipe.image ? { image: recipe.image } : {}) } } : {}),
  };
}

/**
 * Valio Aimo's own selling agent proposes one seasonal product to the buyer's agent. The buyer's agent may only show
 * it to a person: it never orders a proposal alone.
 */
export function seasonalSuggestion(product: Product, label: string, reason: string): Suggestion {
  return {
    id: `seasonal:${product.id}`,
    kind: "seasonal",
    topic: "new_product",
    headline: "Valio Aimo suggests",
    sentence: `Valio Aimo suggests ${label} ${reason}.`,
    action: {
      type: "add_to_order",
      label: "Add to order",
      payload: {
        from: "Valio Aimo",
        product: { id: product.id, name: product.name.en || product.name.fi },
        rule: "A person decides. Your agent never orders a proposal alone.",
      },
    },
  };
}
