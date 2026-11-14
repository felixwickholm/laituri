import type { Product } from "@/lib/contracts";
import { productFat, type FatLevel } from "@/lib/catalog/lexicon";
import { productText, words as wordsOf } from "@/lib/catalog/text";

/** Whether a delivered product has an attribute the words state: yes, no, or the product data cannot tell. */
export type AttributeAnswer = "yes" | "no" | "unknown";

/** A product attribute a buyer can state in words, and how the delivered product shows it. */
export interface StatedAttribute {
  /** As the check names it: "UHT", "chilled", "skimmed", "carton". */
  label: string;
  /** The words that state it, folded to lower case. */
  words: string[];
  has(product: Pick<Product, "name">): AttributeAnswer;
}

const isUht = (product: Pick<Product, "name">) => wordsOf(productText(product)).includes("uht");

/** Product names always say UHT, so a name without it is a chilled product, not an unknown one. */
const STORAGE: StatedAttribute[] = [
  { label: "UHT", words: ["uht", "longlife"], has: (product) => (isUht(product) ? "yes" : "no") },
  { label: "chilled", words: ["fresh", "chilled", "tuore", "tuoretta", "färsk", "kyld"], has: (product) => (isUht(product) ? "no" : "yes") },
];

/** A pack type is often not in the name, so a name without it cannot tell. */
const PACKS: [label: string, words: string[]][] = [
  ["carton", ["carton", "cartons", "tetra", "tölkki", "kartong"]],
  ["bottle", ["bottle", "bottles", "pullo", "flaska"]],
  ["bag", ["bag", "bags", "pussi", "påse"]],
  ["can", ["can", "cans", "tin", "tins", "purkki", "burk"]],
  ["bucket", ["bucket", "buckets", "ämpäri", "hink"]],
];

const PACK_ATTRIBUTES: StatedAttribute[] = PACKS.map(([label, words]) => ({
  label,
  words,
  has: (product) => (wordsOf(productText(product)).some((word) => words.includes(word)) ? "yes" : "unknown"),
}));

const WORD_ATTRIBUTES = [...STORAGE, ...PACK_ATTRIBUTES];

const FAT_LABEL: Record<FatLevel, string> = { skimmed: "skimmed", semi_skimmed: "semi-skimmed", whole: "whole" };

/** The fat level the words state, held against the fat level in the delivered product's name. */
export function fatAttribute(fat: FatLevel): StatedAttribute {
  return {
    label: FAT_LABEL[fat],
    words: [],
    has: (product) => {
      const found = productFat(productText(product));
      if (!found) return "unknown";
      return found === fat ? "yes" : "no";
    },
  };
}

/** The attributes stated by the words no other rule explained, and the words that are left. */
export function attributesIn(leftovers: string[]): { attributes: StatedAttribute[]; rest: string[] } {
  const attributes = WORD_ATTRIBUTES.filter((attribute) => attribute.words.some((word) => leftovers.includes(word)));
  const used = new Set(attributes.flatMap((attribute) => attribute.words));
  return { attributes, rest: leftovers.filter((word) => !used.has(word)) };
}
