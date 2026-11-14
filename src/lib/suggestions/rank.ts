import type { Suggestion } from "@/lib/contracts";

export const MAX_SUGGESTIONS = 6;

/**
 * What needs the kitchen soonest comes first: the event, the order that closes, then the season's recipe, a recipe
 * from what it buys, low stock, and the wholesaler's product offer.
 */
const ORDER: string[] = ["event", "weekly_due", "drift", "seasonal:season", "seasonal:usual", "low_pantry", "seasonal:new_product", "seasonal"];

function place(suggestion: Suggestion): number {
  const at = ORDER.indexOf(suggestion.topic ? `${suggestion.kind}:${suggestion.topic}` : suggestion.kind);
  return at < 0 ? ORDER.indexOf(suggestion.kind) : at;
}

export function rankSuggestions(candidates: (Suggestion | undefined)[]): Suggestion[] {
  return candidates
    .filter((suggestion): suggestion is Suggestion => suggestion !== undefined)
    .sort((a, b) => place(a) - place(b))
    .slice(0, MAX_SUGGESTIONS);
}
