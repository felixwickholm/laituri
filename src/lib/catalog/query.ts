import {
  CLAIM_MODIFIERS,
  CONCEPTS,
  FAT_MODIFIERS,
  FAT_PREFIXES,
  FINNISH_MODIFIER,
  type ConceptDef,
  type FatLevel,
} from "./lexicon";
import { words } from "./text";

export interface ParsedQuery {
  concept?: ConceptDef;
  claims: string[];
  fat?: FatLevel;
  finnish: boolean;
  quantity?: { amount: number; unit: "l" | "kg" };
  /** Words that no rule explained, for example a brand. */
  leftovers: string[];
  /** Concepts named in the query besides the chosen one. */
  otherConcepts: string[];
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "with", "in", "to", "some", "please", "need", "we", "i", "buy", "order", "get",
  "pack", "packs", "pcs", "pieces", "units", "x", "ja", "tai", "sekä", "kpl", "pakkaus", "tarvitaan", "tilaa", "och", "eller",
  "med", "för", "st", "behöver", "beställ",
]);

const QUANTITY = /\b(\d+(?:\.\d+)?) ?(l|ltr|litr\p{L}*|liter\p{L}*|kg|kilo\p{L}*|dl)\b/u;
const NUMBER = /^\d+(?:\.\d+)?%?$/;

function strip(text: string, pattern: RegExp): { text: string; found: boolean } {
  const match = pattern.exec(text);
  if (!match) return { text, found: false };
  return { text: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`, found: true };
}

function wordMatches(token: string, term: string): boolean {
  if (token === term) return true;
  return term.length >= 4 && token.startsWith(term) && token.length - term.length <= 3;
}

interface ConceptHit {
  concept: ConceptDef;
  start: number;
  length: number;
  score: number;
  fat?: FatLevel;
}

function termHit(tokens: string[], start: number, concept: ConceptDef, term: string): ConceptHit | undefined {
  const parts = term.split(" ");
  if (start + parts.length > tokens.length) return undefined;
  const ok = parts.every((part, i) => (i === parts.length - 1 ? wordMatches(tokens[start + i], part) : tokens[start + i] === part));
  if (ok) return { concept, start, length: parts.length, score: term.length };
  if (parts.length > 1) return undefined;
  // Compounds such as "kevytmaito" (semi-skimmed milk) or "lättmjölk".
  for (const [prefix, fat] of FAT_PREFIXES) {
    const token = tokens[start];
    const rest = token.slice(prefix.length).replace(/^-/, "");
    if (token.startsWith(prefix) && rest.length >= 3 && wordMatches(rest, term)) {
      return { concept, start, length: 1, score: token.length, fat: concept.fat ? fat : undefined };
    }
  }
  return undefined;
}

function findConcepts(tokens: string[]): ConceptHit[] {
  const hits: ConceptHit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const concept of CONCEPTS) {
      for (const term of concept.terms) {
        const hit = termHit(tokens, i, concept, term);
        if (hit) hits.push(hit);
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

export function parseQuery(query: string): ParsedQuery {
  let text = words(query).join(" ");
  const claims: string[] = [];
  for (const { claim, pattern } of CLAIM_MODIFIERS) {
    const result = strip(text, pattern);
    if (result.found) claims.push(claim);
    text = result.text;
  }
  const finnish = strip(text, FINNISH_MODIFIER);
  text = finnish.text;
  const quantityMatch = QUANTITY.exec(text);
  let quantity: ParsedQuery["quantity"];
  if (quantityMatch) {
    const amount = Number(quantityMatch[1]);
    const unit = quantityMatch[2].startsWith("k") ? "kg" : "l";
    quantity = { amount: quantityMatch[2] === "dl" ? amount / 10 : amount, unit };
    text = strip(text, QUANTITY).text;
  }

  const tokens = text.split(" ").filter(Boolean);
  const hits = findConcepts(tokens);
  const best = hits[0];
  const used = new Set<number>();
  if (best) for (let i = best.start; i < best.start + best.length; i++) used.add(i);
  let fat = best?.fat;
  let rest = tokens.filter((_, i) => !used.has(i)).join(" ");
  if (!best || best.concept.fat) {
    for (const modifier of FAT_MODIFIERS) {
      const result = strip(rest, modifier.pattern);
      if (result.found) fat ??= modifier.fat;
      rest = result.text;
    }
  }
  const leftovers = rest.split(" ").filter((token) => token && !STOPWORDS.has(token) && !NUMBER.test(token));
  const otherConcepts = [...new Set(hits.filter((h) => !used.has(h.start)).map((h) => h.concept.id))]
    .filter((id) => id !== best?.concept.id);
  return { concept: best?.concept, claims, fat, finnish: finnish.found, quantity, leftovers, otherConcepts };
}
