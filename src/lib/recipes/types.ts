import type { Course, KitchenUnit, Occasion } from "@/lib/contracts";

/** What an ingredient is, for vegetarian and vegan menus. */
export type FoodKind = "plant" | "dairy" | "egg" | "meat" | "fish";

/** How the catalogue search finds an ingredient: its words, claims every product must carry, and words its name must hold. */
export interface ProductWords {
  words: string;
  claims?: string[];
  /** Lower-case words the English product name must contain, to keep a search on the right product. */
  nameHas?: string[];
  /** Allergens the ingredient brings, in the catalogue's allergen ids. */
  allergens: string[];
  kind: FoodKind;
}

export interface IngredientDef extends ProductWords {
  amount: number;
  unit: KitchenUnit;
  role: RoleId;
  /** What the ingredient does in this dish: "cooking cream: richness in the sauce". */
  purpose: string;
  /** The line as the source recipe writes it: "1,000 kg Valio vispikermaa laktoositon". */
  asWritten?: string;
  /** The catalogue product the import matched, and how sure it is. */
  matched?: { productId: string; productName: string; confidence: "high" | "medium" | "low" };
}

/** A line of a source recipe that is not ordered: a kitchen basic, or one with no product in the catalogue. */
export interface UnlistedLine {
  asWritten: string;
  /** The catalogue words in English, when the line matched an ingredient but cannot be ordered (no amount). */
  words?: string;
  allergens: string[];
  kind: FoodKind;
  basic: boolean;
  /** "Kitchen basic." or "Not in the recorded catalogue." */
  reason: string;
}

/** Where a recipe comes from. */
export interface RecipeSource {
  name: string;
  url?: string;
  attribution: string;
}

export interface RecipeDef {
  id: string;
  name: string;
  course: Course;
  occasions: Occasion[];
  /** Portions the amounts make: 10 for our own recipes, Valio's own yield for theirs. */
  serves: number;
  minutes?: number;
  /** One line on how it is made, in our own words. */
  method: string;
  ingredients: IngredientDef[];
  source: RecipeSource;
  /** Our own recipe, kept as a fallback when no Valio recipe fits. */
  fallback?: true;
  /** The Finnish title, for Valio's recipes. */
  nameFi?: string;
  /** A link to the source's photo; the image is not copied. */
  image?: string;
  /** Valio's seasons: joulu, talvi, syksy, kevät, kesä. */
  seasons?: string[];
  /** Words to search by: Valio's tags and the ingredient names as written. */
  searchText?: string;
  /** Lines never ordered; they still count for allergens and food kinds. */
  unlisted?: UnlistedLine[];
  /** Enough of the dish matches products for the planner to cost and order it. */
  plannable: boolean;
}

/** One stand-in for a role, and what it changes, in at most 14 plain words. */
export interface SwapDef extends ProductWords {
  change: string;
}

export interface RoleDef {
  label: string;
  swaps: SwapDef[];
  /** Why nothing may stand in, when that is so: "No swap: the meringue needs egg white." */
  noSwap?: string;
  /** The dish works without it: the sentence says what is lost. */
  canOmit?: string;
}

export type RoleId =
  | "cream_sauce"
  | "whipped_cream"
  | "milk_liquid"
  | "plant_milk"
  | "butter_fat"
  | "frying_oil"
  | "egg_binder"
  | "egg_structure"
  | "egg_white"
  | "egg_main"
  | "wheat_structure"
  | "wheat_thickener"
  | "wheat_dough"
  | "pasta_base"
  | "starch_side"
  | "rice_base"
  | "bread_base"
  | "oat_base"
  | "beef_protein"
  | "white_fish"
  | "salmon_main"
  | "cured_fish"
  | "chicken"
  | "cheese_topping"
  | "soft_cheese"
  | "yoghurt_base"
  | "sour_cream"
  | "fruit_layer"
  | "quark_body"
  | "sugar_sweet"
  | "tomato_base"
  | "aromatic_onion"
  | "root_veg"
  | "potato_body"
  | "gram_batter"
  | "coffee"
  | "tea"
  | "as_written";
