import type { Mandate, Suggestion } from "@/lib/contracts";
import { adaptRecipe } from "@/lib/menu/adapt";
import { dietRules } from "@/lib/menu/dietary";
import type { RecipeDef } from "@/lib/recipes";

/** Valio's season tags by month: Christmas dishes in November and December. */
const SEASON_BY_MONTH: Record<number, { tag: string; label: string }> = {
  11: { tag: "joulu", label: "Christmas" },
  12: { tag: "joulu", label: "Christmas" },
  1: { tag: "talvi", label: "Winter" },
  2: { tag: "talvi", label: "Winter" },
  3: { tag: "kevät", label: "Spring" },
  4: { tag: "kevät", label: "Spring" },
  5: { tag: "kevät", label: "Spring" },
  6: { tag: "kesä", label: "Summer" },
  7: { tag: "kesä", label: "Summer" },
  8: { tag: "kesä", label: "Summer" },
  9: { tag: "syksy", label: "Autumn" },
  10: { tag: "syksy", label: "Autumn" },
};

/** A Valio recipe the planner can use and the kitchen's mandate allows, as written or by swaps. */
function allowed(def: RecipeDef, mandate: Mandate): boolean {
  return def.source.name === "Valio" && def.plannable && adaptRecipe(def, dietRules([], mandate), []).ok;
}

/** "Rice porridge" -> "rice porridge" inside a sentence; "BBQ chicken kebab" keeps its capitals. */
export function lower(name: string): string {
  return /^[A-ZÅÄÖ][a-zåäö]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

function openRecipe(def: RecipeDef): Suggestion["action"] {
  return { type: "open_recipe", label: "Open the recipe", payload: { recipeId: def.id, source: def.source } };
}

function recipeRef(def: RecipeDef): NonNullable<Suggestion["recipe"]> {
  return { id: def.id, name: def.name, source: def.source, ...(def.image ? { image: def.image } : {}) };
}

/** The first Valio recipe tagged for this month's season, mains and desserts before the rest. */
export function seasonRecipe(library: RecipeDef[], mandate: Mandate, month: number): Suggestion | undefined {
  const season = SEASON_BY_MONTH[month];
  if (!season) return undefined;
  const order = ["main", "dessert", "starter", "side", "drink"];
  const def = library
    .filter((entry) => entry.seasons?.includes(season.tag) && allowed(entry, mandate))
    .sort((a, b) => order.indexOf(a.course) - order.indexOf(b.course))[0];
  if (!def) return undefined;
  const occasion = season.tag === "joulu" ? "pikkujoulu buffets" : `${season.label.toLowerCase()} menus`;
  return {
    id: `season_recipe:${def.id}`,
    kind: "seasonal",
    topic: "season",
    headline: `${season.label} idea from Valio`,
    sentence: `For ${occasion}: Valio's ${lower(def.name)}, for ${def.serves} as written.`,
    action: openRecipe(def),
    recipe: recipeRef(def),
  };
}

/**
 * The Valio recipe that uses most of what the kitchen already buys, by product type; at least two of its products.
 * `bought` counts how often each product type was ordered.
 */
export function usualRecipe(
  library: RecipeDef[],
  mandate: Mandate,
  bought: Map<string, number>,
  conceptOf: (productId: string) => string | undefined,
): Suggestion | undefined {
  let best: { def: RecipeDef; shared: string[]; score: number } | undefined;
  for (const def of library) {
    if (def.course === "drink" || !allowed(def, mandate)) continue;
    const shared = [...new Set(def.ingredients.flatMap((line) => {
      const concept = line.matched ? conceptOf(line.matched.productId) : undefined;
      return concept && bought.has(concept) ? [line.words] : [];
    }))];
    const score = def.ingredients.reduce((sum, line) => {
      const concept = line.matched ? conceptOf(line.matched.productId) : undefined;
      return sum + (concept ? (bought.get(concept) ?? 0) : 0);
    }, 0);
    if (shared.length >= 2 && (!best || score > best.score)) best = { def, shared, score };
  }
  if (!best) return undefined;
  const [first, second] = best.shared.map((words) => words.replace(/^lactose-free /, ""));
  return {
    id: `usual_recipe:${best.def.id}`,
    kind: "seasonal",
    topic: "usual",
    headline: "Uses what you buy",
    sentence: `You already buy ${first} and ${second}. Valio's ${lower(best.def.name)} uses both.`,
    action: openRecipe(best.def),
    recipe: recipeRef(best.def),
  };
}

/** The Valio recipe to name with an event: the first one the planner could put on that menu. */
export function eventRecipe(found: { id: string }[], library: RecipeDef[]): RecipeDef | undefined {
  return found.map((summary) => library.find((def) => def.id === summary.id)).find((def): def is RecipeDef => Boolean(def?.plannable && def.source.name === "Valio"));
}
