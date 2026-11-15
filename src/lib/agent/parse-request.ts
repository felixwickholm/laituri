import type { Quantity } from "@/lib/contracts";
import { readInstructions } from "@/lib/request/instructions";
import { addDays, helsinkiDate, isValidDate, nextWeekday, nextWorkingDay } from "./dates";
import type { ParsedRequest } from "./types";

type Unit = Quantity["unit"];

/** Boxes and cases: a count, but of a size only the buyer knows, so the agent asks before it orders. */
const PACKAGE = /^(?:cases?|boxes|box|crates?|laatikk\p{L}*|lådor|låda|lådan)$/u;

const UNITS: [RegExp, Unit, number][] = [
  [/^(?:litres?|liters?|litraa?|ltr|l)$/, "l", 1],
  [/^(?:kilograms?|kilos?|kiloa|kg)$/, "kg", 1],
  [/^(?:grams?|grammaa?|g)$/, "kg", 0.001],
  [/^(?:dl|desilitraa?|deciliters?|decilitres?)$/, "l", 0.1],
  [/^(?:pieces?|pcs|pc|units?|kpl|st|styck|packs?|bottles?|pullo\p{L}*|paketti\p{L}*|pakettia|pkt|flaskor|flaska|paket)$/u, "sales_unit", 1],
  [PACKAGE, "sales_unit", 1],
];

const WEEKDAYS: [RegExp, number][] = [
  [/^(?:sunday|söndagen|söndag|sunnuntai\p{L}*)$/u, 0],
  [/^(?:monday|måndagen|måndag|maanantai\p{L}*)$/u, 1],
  [/^(?:tuesday|tisdagen|tisdag|tiistai\p{L}*)$/u, 2],
  [/^(?:wednesday|onsdagen|onsdag|keskiviikko\p{L}*|keskiviikkoon)$/u, 3],
  [/^(?:thursday|torsdagen|torsdag|torstai\p{L}*)$/u, 4],
  [/^(?:friday|fredagen|fredag|perjantai\p{L}*)$/u, 5],
  [/^(?:saturday|lördagen|lördag|lauantai\p{L}*)$/u, 6],
];

const RELATIVE: [RegExp, number][] = [
  [/^(?:today|tänään|idag)$/u, 0],
  [/^(?:tomorrow|imorgon|huomenna|huomiseksi|huomiselle|huomiseen)$/u, 1],
  [/^(?:ylihuomenna|ylihuomiseksi)$/u, 2],
];

const NUMBER_WORDS: Record<string, number> = {
  thousand: 1000, tuhat: 1000, tusen: 1000, hundred: 100, sata: 100, hundra: 100,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, dozen: 12, twenty: 20, fifty: 50,
  yksi: 1, kaksi: 2, kaks: 2, kolme: 3, neljä: 4, viisi: 5, kuusi: 6, seitsemän: 7, kahdeksan: 8, yhdeksän: 9, kymmenen: 10, tusina: 12, kaksikymmentä: 20, viisikymmentä: 50,
  ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8, nio: 9, tio: 10, tolv: 12, tjugo: 20, femtio: 50,
  half: 0.5, puoli: 0.5, halv: 0.5,
};

const FILLER = new Set([
  "of", "for", "by", "on", "the", "a", "an", "please", "i", "we", "need", "want", "order", "buy", "get",
  "about", "around", "approx", "approximately", "noin", "tilaa", "tilataan", "tarvitaan", "tarvitsen",
  "tarvitsemme", "ostetaan", "deliver", "delivered", "delivery", "toimitus", "until", "before", "next",
  "product", "tuote", "x", "and", "ja", "some", "me", "us", "my", "our", "can", "could", "you", "would", "like", "pls",
  "send", "bring", "haluan", "haluaisin", "tilaisin", "laita", "laittakaa", "tuokaa", "meille", "mulle", "minulle", "vähän",
  "jotain", "kiitos", "jag", "vi", "behöver", "beställ", "köp", "skicka", "vill", "ha", "lite", "några", "tack", "till", "oss",
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
  /** Which sentence or clause of the request the word is in. */
  clause: number;
}

/** A sentence or clause ends at . ! ? ; or a line break, but not at the point inside a number such as 1.5. */
const CLAUSE_END = /[!?;\n]|\.(?!\d)/;

/** Words that tie a date to the request ("by Monday", "maanantaihin mennessä"); they are read with the date. */
const DATE_BEFORE = new Set(["by", "on", "for", "until", "till", "before", "senast", "på", "innan", "tills"]);
const DATE_AFTER = new Set(["mennessä", "asti"]);

function tokenize(text: string): Token[] {
  // Join thousands written with a space ("1 000") before splitting into words.
  const joined = text.replace(/(\d)[\s ](?=\d{3}\b)/g, "$1");
  return joined.split(CLAUSE_END).flatMap((part, clause) =>
    (part.match(WORD) ?? []).map((word) => {
      const raw = word.replace(/[,.]+$/, "");
      return { text: raw.toLowerCase(), raw, used: false, clause };
    }),
  );
}

/** Marks the date and the words that tie it to the request. */
function markDate(tokens: Token[], at: number): void {
  const date = tokens[at];
  date.used = true;
  const before = tokens[at - 1];
  const after = tokens[at + 1];
  if (before?.clause === date.clause && DATE_BEFORE.has(before.text)) before.used = true;
  if (after?.clause === date.clause && DATE_AFTER.has(after.text)) after.used = true;
}

function findDate(tokens: Token[], today: string): string | undefined {
  for (const [at, token] of tokens.entries()) {
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
      markDate(tokens, at);
      return date;
    }
  }
  return undefined;
}

/** The quantity, and the clause it is in. */
function findQuantity(tokens: Token[]): { quantity?: Quantity; clause?: number; packageWord?: string } {
  const numberAt = (i: number): number | undefined => {
    const word = tokens[i]?.text;
    if (!word || tokens[i].used) return undefined;
    if (NUMBER_WORDS[word]) return NUMBER_WORDS[word];
    return /^\d[\d.,]*$/.test(word) && !/^\d{6}$/.test(word) ? parseNumber(word) : undefined;
  };
  // A number followed by a unit wins: "200 units of Valio milk 1 l" is 200 units. A box count gives way to litres or
  // kilos given in the same request ("two boxes of cream (20 l)"); its words are still read, so they leave the phrase.
  type Found = { quantity: Quantity; clause: number; at: number[]; packageWord?: string };
  const found: Found[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const glued = tokens[i].text.match(/^(\d[\d.,]*)(\p{L}+)$/u);
    const amount = glued ? parseNumber(glued[1]) : numberAt(i);
    const unit = unitOf(glued ? glued[2] : tokens[i + 1]?.text ?? "");
    if (amount === undefined || !unit || amount <= 0) continue;
    const unitWord = glued ? glued[2] : tokens[i + 1].text;
    found.push({
      quantity: { amount: round(amount * unit[1]), unit: unit[0] },
      clause: tokens[i].clause,
      at: glued ? [i] : [i, i + 1],
      ...(PACKAGE.test(unitWord) ? { packageWord: unitWord } : {}),
    });
  }
  const chosen = found.find((item) => !item.packageWord) ?? found[0];
  if (chosen) {
    for (const item of found) if (item === chosen || item.packageWord) for (const at of item.at) tokens[at].used = true;
    return { quantity: chosen.quantity, clause: chosen.clause, ...(chosen.packageWord ? { packageWord: chosen.packageWord } : {}) };
  }
  for (let i = 0; i < tokens.length; i++) {
    const amount = numberAt(i);
    if (amount === undefined || amount <= 0) continue;
    tokens[i].used = true;
    return { quantity: { amount, unit: "sales_unit" }, clause: tokens[i].clause };
  }
  return {};
}

function findProductCode(tokens: Token[]): string | undefined {
  const token = tokens.find((t) => !t.used && /^#?\d{6}$/.test(t.text));
  if (!token) return undefined;
  token.used = true;
  return token.text.replace("#", "");
}

function trimmed(words: Token[]): string {
  const kept = [...words];
  while (kept.length && FILLER.has(kept[0].text)) kept.shift();
  while (kept.length && FILLER.has(kept[kept.length - 1].text)) kept.pop();
  return kept.map((t) => t.raw).join(" ");
}

/** The product words, and what the buyer said it is for: "milk for the breakfast buffets". */
function phraseOf(tokens: Token[]): { phrase: string; purpose?: string } {
  const words = tokens.filter((t) => !t.used);
  if (words.length === 0) return { phrase: "" };
  const start = words.findIndex((t) => !FILLER.has(t.text));
  const forAt = words.findIndex((t, i) => i > start && start >= 0 && t.text === "for");
  if (forAt === -1) return { phrase: trimmed(words) };
  const purpose = trimmed(words.slice(forAt + 1));
  return { phrase: trimmed(words.slice(0, forAt)), ...(purpose ? { purpose } : {}) };
}

/** The clause that names the order (the one with the quantity), and the other clauses' unread words as written. */
function splitClauses(tokens: Token[], main: number): { order: Token[]; others: string[] } {
  const others = new Map<number, string[]>();
  for (const token of tokens) {
    if (token.clause === main || token.used) continue;
    others.set(token.clause, [...(others.get(token.clause) ?? []), token.raw]);
  }
  return { order: tokens.filter((t) => t.clause === main), others: [...others.values()].map((words) => words.join(" ")) };
}

/** Reads quantity, product, delivery date, a spending ceiling and an order to wait, in English or Finnish. */
export function parseRequest(text: string, now: Date): ParsedRequest {
  const today = helsinkiDate(now);
  const instructions = readInstructions(text);
  const tokens = tokenize(instructions.rest);
  const stated = findDate(tokens, today);
  const { quantity, clause = 0, packageWord } = findQuantity(tokens);
  const productId = findProductCode(tokens);
  const { order, others } = splitClauses(tokens, clause);
  return {
    text,
    quantity,
    ...phraseOf(order),
    otherClauses: others,
    productId,
    deliverBy: stated ?? nextWorkingDay(today),
    deliverByStated: stated !== undefined,
    ...(instructions.budget !== undefined ? { budget: instructions.budget } : {}),
    waitForPerson: instructions.waitForPerson,
    ...(packageWord ? { packageWord } : {}),
  };
}
