import type { Product } from "@/lib/contracts";
import { productFat, type ConceptDef } from "./lexicon";
import type { ParsedQuery } from "./query";

/** A product with its folded names, prepared once per catalog. */
export interface Entry {
  product: Product;
  text: string;
  words: string[];
}

/** Variant markers: a buyer who asks for "milk" wants the everyday staple, not these. */
const VARIANTS: [label: string, pattern: RegExp][] = [
  ["UHT", /\buht\b/],
  ["portion pack", /(portion|annos|\bmini\b|snack)/],
  ["flavoured", /(flavour|maustettu|vanil|mansik|strawberr|choco|kaakao|cocoa|caramel|mango|berry|marja)/],
  ["fortified", /(protein|proteiini|vitamin|vitamiini|\bplus\b|gefilus|\bab\b|hyla|a2)/],
  ["speciality", /(barista|kiehu|special|deli\b|gourmet|premium)/],
  ["small pack", /\b\d+(?:\.\d+)? ?(dl|cl|ml)\b/],
];
const ORGANIC = /(organic|luomu|ekologisk)/;

export function wordMatch(words: string[], term: string): boolean {
  return words.some((w) => w === term || (term.length >= 3 && w.startsWith(term)));
}

function sizeScore(product: Product, parsed: ParsedQuery, concept: ConceptDef | undefined, matched: string[]): number {
  const content = product.content;
  if (!content) return 0;
  const quantity = parsed.quantity;
  if (quantity && quantity.unit === content.unit) {
    // Large orders favour the largest pack that does not exceed the need.
    if (content.amount > quantity.amount * 1.5) return -0.15;
    const fit = Math.log(1 + content.amount) / Math.log(1 + quantity.amount);
    if (fit > 0.5) matched.push(`pack suits ${quantity.amount} ${quantity.unit}`);
    return 0.25 * fit;
  }
  const typical = concept?.typical;
  if (!typical || typical.unit !== content.unit) return 0;
  if (Math.abs(content.amount - typical.amount) < 1e-6) {
    matched.push(`standard ${typical.amount} ${typical.unit} pack`);
    return 0.12;
  }
  if (content.amount < typical.amount * 0.5) return -0.1;
  return content.amount <= typical.amount * 2 ? 0.04 : 0;
}

/** Higher is better. Every bonus adds a reason to `matched`. */
export function rank(entry: Entry, parsed: ParsedQuery, concept: ConceptDef | undefined): { score: number; matched: string[] } {
  const { product, text, words } = entry;
  const matched: string[] = [];
  let score = 1;
  if (concept) matched.push(`concept ${concept.id}`);
  for (const claim of parsed.claims) matched.push(`claim ${claim}`);

  if (parsed.fat) {
    const fat = productFat(text);
    if (fat === parsed.fat) {
      score += 0.3;
      matched.push(`fat ${fat}`);
    } else if (fat) score -= 0.3;
  }
  for (const word of parsed.leftovers) {
    if (wordMatch(words, word)) {
      score += 0.15;
      matched.push(`name has "${word}"`);
    }
  }
  if (parsed.finnish && (product.origin === "FI" || product.labels.includes("finnish_origin"))) {
    score += 0.15;
    matched.push("Finnish origin");
  }
  for (const [, pattern] of VARIANTS) if (pattern.test(text)) score -= 0.08;
  if (!parsed.claims.includes("organic") && ORGANIC.test(text)) score -= 0.05;

  score += sizeScore(product, parsed, concept, matched);
  score += 0.1 * (product.deliveryReliability ?? 0.9);
  score -= Math.min(text.length, 300) / 30_000;
  return { score: Math.round(score * 1000) / 1000, matched };
}
