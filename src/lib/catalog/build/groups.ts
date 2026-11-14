/**
 * Readable category groups derived from the wholesaler's 5-digit category codes.
 * Ranges were read off the product download; the first matching rule wins.
 */
const RULES: [group: string, codes: string[]][] = [
  ["plant_based", ["10402", "10406", "10413", "10418", "10641", "17306", "41754"]],
  ["cheese", ["106", "41771"]],
  ["dairy", ["104", "10500", "10501", "10502"]],
  ["eggs", ["1059"]],
  ["fats_oils", ["105"]],
  ["bakery", ["109", "11030", "4176"]],
  ["meat", ["172", "1871", "1872", "1873", "1874", "1875", "1876", "4170", "4171"]],
  ["fish", ["1870", "4172", "21530"]],
  ["ready_meals", ["173", "4175", "41830", "21510", "21900", "21901", "21600"]],
  ["produce", ["174", "4173", "4174"]],
  ["ice_cream", ["418"]],
  ["snacks_sweets", ["2113", "2114", "2115", "2199", "52"]],
  ["preserves", ["2145", "215"]],
  ["sauces_condiments", ["219", "2261", "2262", "2264"]],
  ["coffee_tea", ["223", "224", "225"]],
  ["beverages", ["214", "227", "849", "850"]],
  ["baking_spices", ["221", "2260", "2263", "2266", "2267"]],
  ["dry_goods", ["21"]],
  ["non_food", ["2", "3", "6", "7", "9"]],
];

const LABELS: Record<string, string> = {
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
  other: "Other",
};

export const CATEGORY_GROUPS = Object.keys(LABELS);

export function categoryGroup(code: string): string {
  for (const [group, prefixes] of RULES) {
    if (prefixes.some((p) => code.startsWith(p))) return group;
  }
  return "other";
}

export function categoryGroupLabel(group: string): string {
  return LABELS[group] ?? group;
}
