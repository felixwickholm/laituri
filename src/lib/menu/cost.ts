import type { Course, Mandate } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import type { RecipeDef } from "@/lib/recipes";
import type { UpstreamClient } from "@/lib/valio/types";
import { adaptRecipe } from "./adapt";
import { dietRules } from "./dietary";
import { candidatesFor, marketFor } from "./products";
import { needsOf, shoppingLine, stockLeft } from "./shopping";

/**
 * Plausible food cost per portion, net EUR, by course. A Valio recipe below the floor is missing its main ingredients
 * in the catalogue (a plant mince, a pastry dough), so the planner would show a menu that looks free; above the
 * ceiling something is scaled wrong. The planner uses only recipes inside the range.
 */
export const PLAUSIBLE_COST: Record<Course, { min: number; max: number }> = {
  main: { min: 0.8, max: 25 },
  starter: { min: 0.3, max: 15 },
  side: { min: 0.1, max: 10 },
  dessert: { min: 0.3, max: 15 },
  drink: { min: 0.05, max: 5 },
};

export function plausibleCost(course: Course, perPortion: number): boolean {
  const range = PLAUSIBLE_COST[course];
  return perPortion >= range.min && perPortion <= range.max;
}

export interface CostDeps {
  catalog: Pick<Catalog, "search">;
  upstream: UpstreamClient;
  mandate: Mandate;
  now: Date;
  deliverBy: string;
}

/** Food cost per portion of each recipe as written, scaled to the guests, at indicative net prices; no stock counted. */
export async function costPerPortion(defs: RecipeDef[], guests: number, deps: CostDeps): Promise<Map<string, number>> {
  const rules = { ...dietRules([], deps.mandate), excluded: [], excludedTraces: [] };
  const find = (spec: Parameters<typeof candidatesFor>[0]) => candidatesFor(spec, deps.catalog, rules);
  const dishes = defs.map((def) => adaptRecipe(def, rules, [])).flatMap((entry) => (entry.ok ? [entry.dish] : []));
  const ids = dishes.flatMap((dish) => dish.items.flatMap((item) => find(item.spec).map((product) => product.id)));
  const market = await marketFor(ids, deps.deliverBy, { upstream: deps.upstream, customerNumber: deps.mandate.buyer.customerNumber, orders: [], now: deps.now });
  const costs = new Map<string, number>();
  for (const dish of dishes) {
    const lines = needsOf([dish], guests).map((need) => shoppingLine(need, { market, rules, find, findAny: find, stock: stockLeft([]) }));
    costs.set(dish.def.id, Math.round((lines.reduce((sum, line) => sum + line.foodNet, 0) / guests) * 100) / 100);
  }
  return costs;
}
