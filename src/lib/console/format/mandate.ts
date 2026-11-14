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

function listWords(items: string[], last: "and" | "or"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`;
}

/** The mandate in two plain sentences, for the summary card: what the agent may do, and what it asks or never does. */
export function mandateSummary(mandate: Mandate): { may: string; limits: string } {
  const categories = mandate.categories.allowed.length;
  const may = `Your agent may spend up to ${eur(mandate.limits.perOrder.amount)} per order and ${eur(mandate.limits.perWeek.amount)} per week, in ${categories} ${categories === 1 ? "category" : "categories"}.`;
  const asks = ["anything over a limit"];
  if (mandate.approval.firstTimeProducts) asks.push("new products");
  if (!mandate.delivery.allowPartial) asks.push("partial deliveries");
  const allergens = mandate.dietary.excludeAllergens.map((id) => allergenRule(id).replace(/^No /, "").toLowerCase());
  const never = allergens.length ? ` It never buys ${listWords(allergens, "or")}.` : "";
  return { may, limits: `It asks you before ${listWords(asks, "and")}.${never}` };
}
