import type { Mandate, SubstitutionPolicy } from "@/lib/contracts";
import { eur } from "./money";

/** Category groups the catalogue uses, with the words the console shows. */
export const CATEGORY_LABELS: Record<string, string> = {
  dairy: "Dairy",
  cheese: "Cheese",
  plant_based: "Plant-based",
  eggs: "Eggs",
  fats_oils: "Fats and oils",
  bakery: "Bakery",
  meat: "Meat",
  fish: "Fish and seafood",
  ready_meals: "Ready meals",
  produce: "Fruit and vegetables",
  ice_cream: "Ice cream",
  snacks_sweets: "Snacks and sweets",
  preserves: "Preserves",
  sauces_condiments: "Sauces and condiments",
  coffee_tea: "Coffee and tea",
  beverages: "Beverages",
  baking_spices: "Baking and spices",
  dry_goods: "Dry goods",
  non_food: "Non-food",
};

/** Allergens a mandate can rule out, written as the rule itself. */
export const ALLERGEN_RULES: Record<string, string> = {
  nuts: "No nuts",
  peanut: "No peanuts",
  gluten: "No gluten",
  milk: "No milk",
  lactose: "No lactose",
  egg: "No egg",
  soy: "No soy",
  sesame: "No sesame",
  fish: "No fish",
  crustaceans: "No crustaceans",
  molluscs: "No molluscs",
  mustard: "No mustard",
  celery: "No celery",
  lupin: "No lupin",
  sulphites: "No sulphites",
};

export const SUBSTITUTION_OPTIONS: { value: SubstitutionPolicy; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "like_for_like", label: "Same product, other brand" },
  { value: "any_within_rules", label: "Any within rules" },
];

export function categoryLabel(id: string): string {
  return CATEGORY_LABELS[id] ?? CATEGORY_LABELS[id.replace(/\s+/g, "_")] ?? id.replace(/_/g, " ");
}

export function allergenRule(id: string): string {
  return ALLERGEN_RULES[id] ?? `No ${id.replace(/_/g, " ")}`;
}

export interface Tiers {
  alone: string[];
  ask: string[];
  never: string[];
}

/** The mandate read as three plain tiers: what the agent may do alone, when it asks, what it never does. */
export function tiers(mandate: Mandate): Tiers {
  const allergens = mandate.dietary.excludeAllergens.map((id) => allergenRule(id).replace(/^No /, ""));
  const alone = [
    `Orders up to ${eur(mandate.limits.perOrder.amount)}`,
    `Up to ${eur(mandate.limits.perWeek.amount)} a week`,
    `${mandate.categories.allowed.length} categories`,
  ];
  const ask = ["Anything over a limit", "Other categories"];
  if (mandate.substitution.policy === "like_for_like") ask.push("A substitute of another kind");
  if (!mandate.delivery.allowPartial) ask.push("Partial deliveries");
  if (mandate.approval.firstTimeProducts) ask.push("First-time products");
  const delay = mandate.delivery.maxDelayDays;
  const never: string[] = [];
  if (allergens.length) never.push(`Buy ${allergens.join(" or ")}`);
  never.push(`Accept delivery over ${delay} ${delay === 1 ? "day" : "days"} late`, "Use an altered or expired offer");
  if (mandate.substitution.policy === "none") never.push("Substitute a product");
  return { alone, ask, never };
}
