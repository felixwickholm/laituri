import { classificationIds, type RawProduct } from "./raw-product";

/** GS1 allergen type codes -> readable allergen ids. Tree nut and gluten-cereal subtypes roll up to their family. */
const ALLERGEN_CODES: Record<string, string[]> = {
  AM: ["milk"],
  ML: ["lactose"],
  AW: ["gluten"],
  UW: ["wheat", "gluten"],
  GB: ["barley", "gluten"],
  NR: ["rye", "gluten"],
  GO: ["oats"],
  GS: ["spelt", "gluten"],
  GK: ["kamut", "gluten"],
  AE: ["egg"],
  AN: ["nuts"],
  SA: ["almond", "nuts"],
  SH: ["hazelnut", "nuts"],
  SW: ["walnut", "nuts"],
  SC: ["cashew", "nuts"],
  SP: ["pecan", "nuts"],
  SR: ["brazil_nut", "nuts"],
  ST: ["pistachio", "nuts"],
  SM: ["macadamia", "nuts"],
  AY: ["soy"],
  AP: ["peanut"],
  AS: ["sesame"],
  AF: ["fish"],
  AC: ["crustaceans"],
  UM: ["molluscs"],
  BM: ["mustard"],
  BC: ["celery"],
  NL: ["lupin"],
  AU: ["sulphites"],
};

const CLAIM_CODES: Record<string, string> = {
  FREE_FROM_LACTOSE: "lactose_free",
  LOW_LACTOSE: "low_lactose",
  FREE_FROM_GLUTEN: "gluten_free",
  FREE_FROM_WHEAT: "wheat_free",
  FREE_FROM_EGGS: "egg_free",
  FREE_FROM_SOY: "soy_free",
  VEGAN: "vegan",
  VEGETARIAN: "vegetarian",
  FREE_FROM_FAT: "fat_free",
  LOW_FAT: "low_fat",
  NO_ADDED_SUGARS: "no_added_sugar",
  HIGH_PROTEIN: "high_protein",
  HIGH_FIBRE: "high_fibre",
  LOW_SODIUM_SALT: "low_salt",
};

const LABEL_CODES: Record<string, string> = {
  EU_ORGANIC_FARMING: "organic",
  SOIL_ASSOCIATION_ORGANIC_SYMBOL: "organic",
  KRAV_MARK: "organic",
  GOODS_FROM_FINLAND_BLUE_SWAN: "finnish_origin",
  PUHTAASTI_KOTIMAINEN: "finnish_origin",
  MADE_IN_FINLAND_FLAG_WITH_KEY: "made_in_finland",
  FINNISH_HEART_SYMBOL: "heart_symbol",
  MARINE_STEWARDSHIP_COUNCIL_LABEL: "msc",
  AQUACULTURE_STEWARDSHIP_COUNCIL: "asc",
  FAIR_TRADE_MARK: "fairtrade",
  RAINFOREST_ALLIANCE: "rainforest_alliance",
  UTZ_CERTIFIED: "rainforest_alliance",
  SVANEN: "nordic_swan",
  EU_ECO_LABEL: "eu_ecolabel",
  OFFICIAL_ECO_LABEL_SUN: "eco_label",
  DOLPHIN_SAFE: "dolphin_safe",
};

const LACTOSE_FREE_NAME = /(lactose[- ]?free|laktoositon|laktosfri)/i;
const ORGANIC_NAME = /(\borganic\b|\bluomu|\bekologisk)/i;

function sorted(set: Set<string>): string[] {
  return [...set].sort();
}

/** Allergens a product name states outright. A safety net for records that carry no declaration. */
const NAMED_ALLERGENS: [string, RegExp][] = [
  ["peanut", /(peanut|maap[aä]hkin|jordn[oö]t)/],
  ["nuts", /(hazelnut|hasselp[aä]hkin|almond|manteli|cashew|walnut|saksanp[aä]hkin|pistachio|pistaasi|pecan|(?<!maa|muskotti|kookos)p[aä]hkin[aä]|\bnuts?\b|\bn[oö]tter\b)/],
];

export function allergensOf(raw: RawProduct, claims: string[], nameText = "") {
  const contains = new Set<string>();
  const mayContain = new Set<string>();
  const freeFrom = new Set<string>();
  for (const value of classificationIds(raw, "allergen")) {
    const target = value.unit === "CONTAINS" ? contains : value.unit === "MAY_CONTAIN" ? mayContain : undefined;
    for (const name of ALLERGEN_CODES[value.id] ?? []) target?.add(name);
  }
  for (const value of classificationIds(raw, "nonAllergen")) {
    for (const name of ALLERGEN_CODES[value.id] ?? []) if (!contains.has(name)) freeFrom.add(name);
  }
  for (const [name, pattern] of NAMED_ALLERGENS) {
    if (!freeFrom.has(name) && pattern.test(nameText)) contains.add(name);
  }
  // Milk carries lactose unless the product is declared lactose free.
  if (contains.has("milk") && !freeFrom.has("lactose") && !claims.includes("lactose_free")) contains.add("lactose");
  if (claims.includes("lactose_free")) {
    contains.delete("lactose");
    freeFrom.add("lactose");
  }
  if (claims.includes("gluten_free")) freeFrom.add("gluten");
  for (const name of contains) mayContain.delete(name);
  return { contains: sorted(contains), mayContain: sorted(mayContain), freeFrom: sorted(freeFrom) };
}

export function claimsOf(raw: RawProduct, names: string): string[] {
  const claims = new Set<string>();
  for (const value of classificationIds(raw, "nutritionalClaim")) {
    const claim = CLAIM_CODES[value.id];
    if (claim) claims.add(claim);
  }
  if (LACTOSE_FREE_NAME.test(names)) claims.add("lactose_free");
  if (claims.has("lactose_free")) claims.delete("low_lactose");
  if (labelsOf(raw).includes("organic") || ORGANIC_NAME.test(names)) claims.add("organic");
  return sorted(claims);
}

export function labelsOf(raw: RawProduct): string[] {
  const labels = new Set<string>();
  for (const value of classificationIds(raw, "packagingMarkedLabel")) {
    const label = LABEL_CODES[value.id];
    if (label) labels.add(label);
  }
  return sorted(labels);
}

/** Temperature condition codes: 1-6 chilled, 7 frozen, 8 ambient. Otherwise the package label decides. */
export function temperatureOf(raw: RawProduct): "ambient" | "chilled" | "frozen" | undefined {
  const code = raw.temperatureCondition;
  if (code !== undefined && code >= 1 && code <= 6) return "chilled";
  if (code === 7) return "frozen";
  if (code === 8) return "ambient";
  const labels = classificationIds(raw, "packagingMarkedLabel").map((v) => v.id);
  if (labels.includes("freezeTemperature")) return "frozen";
  if (labels.includes("coolTemperature")) return "chilled";
  if (labels.includes("warmTemperature")) return "ambient";
  return undefined;
}
