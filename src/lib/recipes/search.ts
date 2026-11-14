import type { Occasion, RecipeSearch, RecipeSummary } from "@/lib/contracts";
import { summaryOf } from "./derive";
import type { RecipeDef } from "./types";

/** Allergen ids each need rules out, read against the dish as written (the planner may still swap). */
const NEED_ALLERGENS: Record<string, string[]> = {
  nut_free: ["nuts", "almond", "peanut"],
  peanut_free: ["peanut"],
  milk_free: ["milk", "lactose"],
  egg_free: ["egg"],
  fish_free: ["fish"],
  sesame_free: ["sesame"],
  soy_free: ["soy"],
};

/** Needs a recipe meets by its label. */
const NEED_LABELS: Record<string, string> = { vegan: "vegan", vegetarian: "vegetarian", lactose_free: "lactose_free", gluten_free: "gluten_free" };

/** What an event word means for the recipe tags: the occasions it suits and whether Christmas dishes go first. */
export function occasionTags(occasion: string | undefined): { occasions: Occasion[]; christmas: boolean } {
  const text = (occasion ?? "").toLowerCase();
  const christmas = /christmas|joulu|pikkujoulu/.test(text);
  if (/wedding|birthday|party|celebration|christmas|joulu|juhla|hää|anniversary|gala/.test(text)) return { occasions: ["celebration"], christmas };
  if (/breakfast|aamiai|brunch/.test(text)) return { occasions: ["breakfast"], christmas };
  if (/lunch|lounas|school|koulu/.test(text)) return { occasions: ["lunch"], christmas };
  if (/buffet|conference|seminar|kokous|noutopöytä/.test(text)) return { occasions: ["buffet", "lunch"], christmas };
  if (/dinner|illallinen/.test(text)) return { occasions: ["dinner"], christmas };
  return { occasions: [], christmas };
}

function meetsNeeds(summary: RecipeSummary, needs: string[]): boolean {
  return needs.every((need) => {
    if (NEED_LABELS[need]) return summary.labels.includes(NEED_LABELS[need]);
    const excluded = NEED_ALLERGENS[need] ?? [];
    return !summary.allergens.some((allergen) => excluded.includes(allergen));
  });
}

function words(text: string | undefined): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
}

/** How well the words find the recipe: in the title counts most; undefined when a word is not found at all. */
function wordScore(def: RecipeDef, terms: string[]): number | undefined {
  const title = `${def.name} ${def.nameFi ?? ""}`.toLowerCase();
  const text = `${title} ${def.searchText ?? ""} ${def.ingredients.map((line) => line.words).join(" ")}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 3;
    else if (text.includes(term)) score += 1;
    else return undefined;
  }
  // The dish itself before its variations: "cream cake" finds Cream cake before Fruit cream cake.
  const phrase = terms.join(" ");
  if (def.name.toLowerCase() === phrase || def.nameFi?.toLowerCase() === phrase) score += 2;
  return score;
}

/**
 * Recipes for an event or a dish, Valio's first: words in the title, tags or ingredients (Finnish or English), the
 * occasion's tags (Christmas dishes first for a Christmas party), the course, and dietary needs met as written.
 */
export function searchRecipes(library: RecipeDef[], request: RecipeSearch): RecipeSummary[] {
  const terms = words(request.words);
  const { occasions, christmas } = occasionTags(request.occasion);
  const needs = request.dietary ?? [];
  const found = library.flatMap((def) => {
    if (request.course && def.course !== request.course) return [];
    if (request.plannable && !def.plannable) return [];
    if (occasions.length && !def.occasions.some((tag) => occasions.includes(tag))) return [];
    const score = terms.length ? wordScore(def, terms) : 0;
    if (score === undefined) return [];
    const summary = summaryOf(def);
    if (!meetsNeeds(summary, needs)) return [];
    const festive = christmas && def.seasons?.includes("joulu") ? 1 : 0;
    return [{ def, summary, score, festive }];
  });
  return found
    .sort(
      (a, b) =>
        Number(Boolean(a.def.fallback)) - Number(Boolean(b.def.fallback)) ||
        b.festive - a.festive ||
        b.score - a.score ||
        Number(b.def.plannable) - Number(a.def.plannable) ||
        a.def.id.localeCompare(b.def.id),
    )
    .slice(0, request.limit ?? 20)
    .map(({ summary }) => summary);
}
