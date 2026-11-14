import { FRESH_CONCEPTS } from "./concepts-fresh";
import { PANTRY_CONCEPTS } from "./concepts-pantry";
import { PROTEIN_AND_PRODUCE_CONCEPTS } from "./concepts-protein";

/**
 * A normalised product type ("milk") with the words buyers use for it in English, Finnish and Swedish,
 * and the rules that decide which catalog products belong to it.
 */
export interface ConceptDef {
  id: string;
  label: string;
  /** Lower-case query words and phrases. Single words of 4+ letters also match inflected forms. */
  terms: string[];
  /** Category code prefixes the product must be in. */
  categories: string[];
  /** Tested against all product names, folded to lower case. */
  include: RegExp;
  exclude?: RegExp;
  /** The standard pack a buyer expects when they do not say otherwise. */
  typical?: { amount: number; unit: "l" | "kg" };
  /** Fat level (skimmed, semi-skimmed, whole) is a meaningful preference for this concept. */
  fat?: boolean;
}

export const CONCEPTS: ConceptDef[] = [...FRESH_CONCEPTS, ...PROTEIN_AND_PRODUCE_CONCEPTS, ...PANTRY_CONCEPTS];

const BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));

export function conceptById(id: string | undefined): ConceptDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** First concept whose category and name rules accept the product. `text` is the folded product names. */
export function assignConcept(text: string, category: string): string | undefined {
  for (const concept of CONCEPTS) {
    if (!concept.categories.some((prefix) => category.startsWith(prefix))) continue;
    if (!concept.include.test(text)) continue;
    if (concept.exclude?.test(text)) continue;
    return concept.id;
  }
  return undefined;
}

export type FatLevel = "skimmed" | "semi_skimmed" | "whole";

/** Query modifiers that become hard claim filters. Patterns run on the folded query. */
export const CLAIM_MODIFIERS: { claim: string; pattern: RegExp }[] = [
  { claim: "lactose_free", pattern: /\b(lactose ?free|laktoositon\p{L}*|laktoosittom\p{L}*|laktosfri\p{L}*|no lactose|without lactose)/u },
  { claim: "low_lactose", pattern: /\b(low lactose|vähälaktoosi\p{L}*|laktosreducerad\p{L}*)/u },
  { claim: "gluten_free", pattern: /\b(gluten ?free|gluteeniton\p{L}*|gluteenittom\p{L}*|glutenfri\p{L}*)/u },
  { claim: "vegan", pattern: /\b(vegan\p{L}*|vegaani\p{L}*|plant based|kasvipohjai\p{L}*|växtbaserad\p{L}*)/u },
  { claim: "organic", pattern: /\b(organic|luomu\p{L}*|ekologisk\p{L}*)/u },
];

/** A word that turns the claim right after it around: "not lactose-free", "ei luomu", "inte ekologisk". */
export const NEGATION = /^(?:not|non|ei|eikä|inte|ej|icke)$/u;

/** Not preceded by a letter or digit: a word start that, unlike \b, also knows ä and ö. */
const START = String.raw`(?<![\p{L}\d])`;

function freeFrom(english: string, finnish: string, swedish: string): RegExp {
  return new RegExp(
    `${START}(?:(?:${english}) free|free from (?:${english})|(?:without|no|non) (?:${english})|(?:${finnish})\\p{L}*|(?:${swedish})\\p{L}*|utan (?:${english}))`,
    "u",
  );
}

/**
 * "Dairy-free", "nut-free" and their Finnish and Swedish forms: the product must not contain the allergen.
 * Peanut comes before nuts, and the word start keeps "peanut free" from also reading as "nut free".
 */
export const EXCLUSION_MODIFIERS: { allergen: string; pattern: RegExp }[] = [
  { allergen: "milk", pattern: freeFrom("dairy|milk", "maidoton|maidottom|maidotto", "mjölkfri|mejerifri") },
  { allergen: "peanut", pattern: freeFrom("peanuts?", "maapähkinätön|maapähkinättöm", "jordnötsfri") },
  { allergen: "nuts", pattern: freeFrom("nuts?", "pähkinätön|pähkinättöm", "nötfri") },
  { allergen: "egg", pattern: freeFrom("eggs?", "kananmunaton|munaton|munattom", "äggfri") },
  { allergen: "soy", pattern: freeFrom("soya?", "soijaton|soijattom", "sojafri") },
  { allergen: "sesame", pattern: freeFrom("sesame", "seesamiton|seesamittom", "sesamfri") },
  { allergen: "fish", pattern: freeFrom("fish", "kalaton|kalattom", "fiskfri") },
];

/** Soft preference: Finnish origin. */
export const FINNISH_MODIFIER = /\b(finnish|from finland|suomalai\p{L}*|kotimai\p{L}*|finsk\p{L}*|inhemsk\p{L}*)/u;

/** Fat words in queries, longest first so "semi skimmed" wins over "skimmed". */
export const FAT_MODIFIERS: { fat: FatLevel; pattern: RegExp }[] = [
  { fat: "semi_skimmed", pattern: /\b(semi ?skimmed|low ?fat|kevyt\p{L}*|lätt\p{L}*|mellan\p{L}*)/u },
  { fat: "skimmed", pattern: /\b(skimmed|skim|fat ?free|non ?fat|rasvaton\p{L}*|rasvatonta|skum\p{L}*|fettfri\p{L}*)/u },
  { fat: "whole", pattern: /\b(whole|full ?fat|täys\p{L}*|helmjölk\p{L}*|standardmjölk\p{L}*)/u },
];

/** Fat prefixes of Finnish and Swedish compounds such as "kevytmaito" or "lättmjölk". */
export const FAT_PREFIXES: [prefix: string, fat: FatLevel][] = [
  ["rasvaton", "skimmed"],
  ["kevyt", "semi_skimmed"],
  ["täys", "whole"],
  ["mellan", "semi_skimmed"],
  ["lätt", "semi_skimmed"],
  ["skum", "skimmed"],
  ["standard", "whole"],
  ["hel", "whole"],
];

/** Fat level stated in a product name, if any. */
export function productFat(text: string): FatLevel | undefined {
  if (/(semi[- ]?skimmed|kevyt|lättmjölk|mellanmjölk|lätt|low[- ]?fat)/.test(text)) return "semi_skimmed";
  if (/(skimmed|rasvaton|skummjölk|fat[- ]?free|fatfree|fettfri)/.test(text)) return "skimmed";
  if (/(whole|täys|helmjölk|standardmjölk|\b3 ?%)/.test(text)) return "whole";
  return undefined;
}
