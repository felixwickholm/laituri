import type { Quantity } from "@/lib/contracts";
import { addDays, helsinkiDate, isValidDate, nextWeekday, nextWorkingDay } from "./dates";
import type { ParsedRequest } from "./types";

type Unit = Quantity["unit"];

const UNITS: [RegExp, Unit, number][] = [
  [/^(?:litres?|liters?|litraa?|ltr|l)$/, "l", 1],
  [/^(?:kilograms?|kilos?|kiloa|kg)$/, "kg", 1],
  [/^(?:grams?|grammaa?|g)$/, "kg", 0.001],
  [/^(?:pieces?|pcs|pc|units?|kpl|packs?|cases?|bottles?)$/, "sales_unit", 1],
];

const WEEKDAYS: [RegExp, number][] = [
  [/^(?:sunday|sunnuntai\p{L}*)$/u, 0],
  [/^(?:monday|maanantai\p{L}*)$/u, 1],
  [/^(?:tuesday|tiistai\p{L}*)$/u, 2],
  [/^(?:wednesday|keskiviikko\p{L}*|keskiviikkoon)$/u, 3],
  [/^(?:thursday|torstai\p{L}*)$/u, 4],
  [/^(?:friday|perjantai\p{L}*)$/u, 5],
  [/^(?:saturday|lauantai\p{L}*)$/u, 6],
];

const RELATIVE: [RegExp, number][] = [
  [/^(?:today|tänään)$/u, 0],
  [/^(?:tomorrow|huomenna|huomiseksi|huomiselle|huomiseen)$/u, 1],
  [/^(?:ylihuomenna|ylihuomiseksi)$/u, 2],
];

const NUMBER_WORDS: Record<string, number> = { thousand: 1000, tuhat: 1000, hundred: 100, sata: 100 };

const FILLER = new Set([
  "of", "for", "by", "on", "the", "a", "an", "please", "i", "we", "need", "want", "order", "buy", "get",
  "about", "around", "approx", "approximately", "noin", "tilaa", "tilataan", "tarvitaan", "tarvitsen",
  "tarvitsemme", "ostetaan", "deliver", "delivered", "delivery", "toimitus", "until", "before", "next",
  "product", "tuote", "x", "and", "ja",
]);

const WORD = /[\p{L}\d][\p{L}\d,.\-]*/gu;

/** "1,000" and "1.000" are thousands; "1,5" and "1.5" are decimals. */
export function parseNumber(raw: string): number | undefined {
  const compact = raw.replace(/[\s ]/g, "");
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(compact)) return Number(compact.replace(/[.,]/g, ""));
  const value = Number(compact.replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

function unitOf(word: string): [Unit, number] | undefined {
  for (const [pattern, unit, factor] of UNITS) if (pattern.test(word)) return [unit, factor];
  return undefined;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

interface Token {
  /** Lower case, for matching. */
  text: string;
  /** As the buyer wrote it, for the product phrase. */
  raw: string;
  used: boolean;
}

function tokenize(text: string): Token[] {
  // Join thousands written with a space ("1 000") before splitting into words.
  const joined = text.replace(/(\d)[\s ](?=\d{3}\b)/g, "$1");
  return (joined.match(WORD) ?? []).map((word) => {
    const raw = word.replace(/[,.]+$/, "");
    return { text: raw.toLowerCase(), raw, used: false };
  });
}

function findDate(tokens: Token[], today: string): string | undefined {
  for (const token of tokens) {
    const word = token.text;
    let date: string | undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(word) && isValidDate(word)) date = word;
    const finnish = word.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
    if (finnish && !date) {
      const year = finnish[3] ?? today.slice(0, 4);
      const candidate = `${year}-${finnish[2].padStart(2, "0")}-${finnish[1].padStart(2, "0")}`;
      if (isValidDate(candidate)) date = !finnish[3] && candidate < today ? `${Number(year) + 1}${candidate.slice(4)}` : candidate;
    }
    for (const [pattern, weekday] of WEEKDAYS) if (!date && pattern.test(word)) date = nextWeekday(today, weekday);
    for (const [pattern, days] of RELATIVE) if (!date && pattern.test(word)) date = addDays(today, days);
    if (date) {
      token.used = true;
      return date;
    }
  }
  return undefined;
}

function findQuantity(tokens: Token[]): Quantity | undefined {
  const numberAt = (i: number): number | undefined => {
    const word = tokens[i]?.text;
    if (!word || tokens[i].used) return undefined;
    if (NUMBER_WORDS[word]) return NUMBER_WORDS[word];
    return /^\d[\d.,]*$/.test(word) && !/^\d{6}$/.test(word) ? parseNumber(word) : undefined;
  };
  // A number followed by a unit wins: "200 units of Valio milk 1 l" is 200 units.
  for (let i = 0; i < tokens.length; i++) {
    const glued = tokens[i].text.match(/^(\d[\d.,]*)(\p{L}+)$/u);
    const amount = glued ? parseNumber(glued[1]) : numberAt(i);
    const unit = unitOf(glued ? glued[2] : tokens[i + 1]?.text ?? "");
    if (amount === undefined || !unit || amount <= 0) continue;
    tokens[i].used = true;
    if (!glued) tokens[i + 1].used = true;
    return { amount: round(amount * unit[1]), unit: unit[0] };
  }
  for (let i = 0; i < tokens.length; i++) {
    const amount = numberAt(i);
    if (amount === undefined || amount <= 0) continue;
    tokens[i].used = true;
    return { amount, unit: "sales_unit" };
  }
  return undefined;
}

function findProductCode(tokens: Token[]): string | undefined {
  const token = tokens.find((t) => !t.used && /^#?\d{6}$/.test(t.text));
  if (!token) return undefined;
  token.used = true;
  return token.text.replace("#", "");
}

function phraseOf(tokens: Token[]): string {
  const words = tokens.filter((t) => !t.used);
  while (words.length && FILLER.has(words[0].text)) words.shift();
  while (words.length && FILLER.has(words[words.length - 1].text)) words.pop();
  return words.map((t) => t.raw).join(" ");
}

/** Reads quantity, product and delivery date from a buyer's request in English or Finnish. */
export function parseRequest(text: string, now: Date): ParsedRequest {
  const today = helsinkiDate(now);
  const tokens = tokenize(text);
  const stated = findDate(tokens, today);
  const quantity = findQuantity(tokens);
  const productId = findProductCode(tokens);
  return {
    text,
    quantity,
    phrase: phraseOf(tokens),
    productId,
    deliverBy: stated ?? nextWorkingDay(today),
    deliverByStated: stated !== undefined,
  };
}
