import type { Course, KitchenUnit, Occasion } from "@/lib/contracts";
import type { FoodKind } from "../types";

/** How sure the import is that an ingredient line is this catalogue product. */
export type MatchConfidence = "high" | "medium" | "low";

/** One catalogue product an ingredient line was matched to, with the words that find it again. */
export interface IngredientMatch {
  /** Catalogue words the planner searches with. */
  words: string;
  claims?: string[];
  nameHas?: string[];
  /** A key of WORDS when the line maps to a known kitchen ingredient. */
  key?: string;
  role: string;
  productId: string;
  productName: string;
  confidence: MatchConfidence;
  /** "lexicon": a known kitchen ingredient the catalogue resolves; "search": the catalogue search alone. */
  how: "lexicon" | "search";
}

/** One ingredient line of a Valio recipe. */
export interface ValioIngredient {
  /** The line as Valio writes it: "1,500 kg kananmunia". */
  asWritten: string;
  /** The ingredient name as written, without the amount: "kananmunia". */
  name: string;
  /** The amount in kitchen units, when the line gives one that converts to kg or l. */
  quantity?: { amount: number; unit: KitchenUnit };
  allergens: string[];
  kind: FoodKind;
  /** Water, salt, pepper, dried herbs and spices: the kitchen has them, nothing is ordered. */
  basic?: true;
  match?: IngredientMatch;
  /** Why the line has no product: "not in the recorded catalogue" or "no amount in kg or l". */
  unmatched?: string;
}

export interface ValioRecipe {
  id: string;
  slug: string;
  title: { fi: string; en: string };
  url: string;
  image?: string;
  /** Portions the amounts make, from the page's yield. */
  serves: number;
  /** The yield as Valio writes it: "16, 16 annosta". */
  yieldText: string;
  course: Course;
  occasions: Occasion[];
  /** Valio's own keywords, kept as written. */
  tags: string[];
  /** Seasons from Valio's tags: joulu, talvi, syksy, kevät, kesä. */
  seasons: string[];
  /** Derived from the ingredients: vegan, vegetarian, lactose_free, gluten_free where true. */
  labels: string[];
  allergens: string[];
  minutes?: number;
  /** One line in our own words; Valio's method is not stored. */
  summary: string;
  ingredients: ValioIngredient[];
  /** Enough of the ingredients (by weight) match products for the planner to cost and order it. */
  plannable: boolean;
  /** Indicative food cost per portion at the recorded prices, for 80 guests, when the recipe was plannable. */
  costPerPortion?: number;
  bucket: string;
}

export interface ValioFile {
  source: { name: "Valio"; site: string; attribution: "Recipe: Valio" };
  importedAt: string;
  matchedAgainst: string;
  stats: { recipes: number; ingredients: number; matched: number; high: number; plannable: number };
  recipes: ValioRecipe[];
}
