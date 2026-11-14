import type { DietaryNeed } from "@/lib/contracts";
import { addDays, isValidDate, nextWeekday } from "@/lib/agent/dates";

/** What the words say about an event. Anything the words do not say is left out. */
export interface ReadEvent {
  guests?: number;
  date?: string;
  occasion?: string;
  dietary: DietaryNeed[];
  /** Courses asked for, when the words say: "three courses", "kolme ruokalajia". */
  courses?: number;
  /** Net EUR per guest, when the words name a budget: "15 € per guest", "alle 20 euroa hengeltä". */
  budgetPerGuest?: number;
}

const WEEKDAYS: [RegExp, number][] = [
  [/^(?:sunday|sunnuntai\p{L}*)$/u, 0],
  [/^(?:monday|maanantai\p{L}*)$/u, 1],
  [/^(?:tuesday|tiistai\p{L}*)$/u, 2],
  [/^(?:wednesday|keskiviiko\p{L}*|keskiviikko\p{L}*)$/u, 3],
  [/^(?:thursday|torstai\p{L}*)$/u, 4],
  [/^(?:friday|perjantai\p{L}*)$/u, 5],
  [/^(?:saturday|lauantai\p{L}*)$/u, 6],
];

const RELATIVE: [RegExp, number][] = [
  [/^(?:today|tonight|tänään|tänä-?iltana)$/u, 0],
  [/^(?:tomorrow|huomenna|huomiseksi|huomiselle)$/u, 1],
  [/^(?:ylihuomenna)$/u, 2],
];

/** Words that count people after (or before) a number: "80 vierasta", "120 vieraalle", "80 ihmiselle". */
const GUEST_WORD = /^(?:guests?|people|persons?|pax|covers|diners|pupils|students|patients|gäster|personer|viera\p{L}*|henge\p{L}*|henkeä|henkilö\p{L}*|hlö\p{L}*|ihmi\p{L}*|oppila\p{L}*|asiak\p{L}*|ruokailija\p{L}*)$/u;

/** A number next to these words is money, not people: "15 € per guest", "20 euroa hengeltä". */
const MONEY_WORD = /^(?:€|eur|euros?|euro\p{L}*)$/u;
/** "per guest", "hengeltä", "kohden": a rate, so the number before it is a price. */
const PER_WORD = /^(?:per|a|kohden|hengeltä|henkilöltä|vieraalta|hlöltä|\/hlö|\/vieras)$/u;

const NUMBER_WORDS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  kaksikymmentä: 20, kolmekymmentä: 30, neljäkymmentä: 40, viisikymmentä: 50, kuusikymmentä: 60,
  seitsemänkymmentä: 70, kahdeksankymmentä: 80, yhdeksänkymmentä: 90, sata: 100,
};

const COURSE_COUNT: [RegExp, number][] = [
  [/\b(?:two|2)[\s-]courses?\b|\bkaksi ruokalajia\b|\bkahden ruokalajin\b/u, 2],
  [/\b(?:three|3)[\s-]courses?\b|\bkolme ruokalajia\b|\bkolmen ruokalajin\b/u, 3],
  [/\b(?:four|4)[\s-]courses?\b|\bneljä ruokalajia\b|\bneljän ruokalajin\b/u, 4],
];

/** First match wins, so the more specific occasions come first. */
const OCCASIONS: [RegExp, string][] = [
  [/\b(?:wedding|häät|häihin|hääjuhla\p{L}*|häissä)/u, "wedding"],
  [/\b(?:christmas party|pikkujoulu\p{L}*)/u, "Christmas party"],
  [/\b(?:birthday|syntymäpäiv\p{L}*|synttär\p{L}*)/u, "birthday"],
  [/\b(?:conference|seminar|meeting|kokous\p{L}*|seminaari\p{L}*|konferenssi\p{L}*)/u, "conference"],
  [/\b(?:breakfast|aamiai\p{L}*)/u, "breakfast"],
  [/\b(?:buffet|seisova\p{L}* pöy\p{L}*|noutopöy\p{L}*)/u, "buffet"],
  [/\b(?:school lunch|kouluruoka\p{L}*|koululounas\p{L}*)/u, "school lunch"],
  [/\b(?:lunch|lounas|lounaa\p{L}*)/u, "lunch"],
  [/\b(?:dinner|illalli\p{L}*|päivälli\p{L}*)/u, "dinner"],
  [/\b(?:party|celebration|juhla\p{L}*|juhli\p{L}*)/u, "party"],
];

/** Each need, the words that state it. Peanut words come before nut words, which they contain. */
const NEEDS: [RegExp, DietaryNeed][] = [
  [/\b(?:peanut[\s-]?free|no peanuts?|without peanuts?|maapähkinätön|ei maapähkinää|maapähkinäallerg\p{L}*|jordnötsfri\p{L}*)/u, "peanut_free"],
  [/\b(?:nut[\s-]?free|no nuts?|without nuts|nut allerg\p{L}*|ei pähkinöitä|ei pähkinää|pähkinätön|pähkinättöm\p{L}*|pähkinäallerg\p{L}*|nötfri\p{L}*)/u, "nut_free"],
  [/\b(?:coeliac\p{L}*|celiac\p{L}*|gluten[\s-]?free|no gluten|without gluten|keliaakik\p{L}*|keliakia\p{L}*|gluteeniton|gluteenittom\p{L}*|ei gluteenia|glutenfri\p{L}*|celiaki\p{L}*)/u, "gluten_free"],
  [/\b(?:lactose[\s-]?free|no lactose|lactose intoleran\p{L}*|laktoositon|laktoosittom\p{L}*|ei laktoosia|laktosfri\p{L}*)/u, "lactose_free"],
  [/\b(?:dairy[\s-]?free|milk[\s-]?free|no dairy|no milk|milk allerg\p{L}*|maidoton|maidottom\p{L}*|ei maitoa|maitoallerg\p{L}*)/u, "milk_free"],
  [/\b(?:egg[\s-]?free|no eggs?|without eggs?|egg allerg\p{L}*|munaton|munattom\p{L}*|ei kananmunaa|ei munaa|kananmuna-allerg\p{L}*)/u, "egg_free"],
  [/\b(?:fish[\s-]?free|no fish|fish allerg\p{L}*|kalaton|ei kalaa|kala-allerg\p{L}*)/u, "fish_free"],
  [/\b(?:sesame[\s-]?free|no sesame|seesamiton|ei seesamia)/u, "sesame_free"],
  [/\b(?:soy[\s-]?free|no soy|soijaton|ei soijaa)/u, "soy_free"],
  [/\b(?:vegan\p{L}*|vegaani\p{L}*|kasvipohjai\p{L}*)/u, "vegan"],
  [/\b(?:vegetarian\p{L}*|kasvis\p{L}*|lihaton|ei lihaa)/u, "vegetarian"],
];

/**
 * What a word after "no", "without", "ei", "ilman" or "utan" rules out: "no nuts or sesame", "ei kalaa eikä kananmunaa",
 * "ilman gluteenia", "utan nötter". The same stems before -ton, -tön, -ttoma or -ttömä: "gluteeniton", "munaton".
 */
const NAMED_AFTER_NO: [RegExp, DietaryNeed][] = [
  [/^(?:peanuts?|maapähkin|jordnöt)/u, "peanut_free"],
  [/^(?:nuts?|pähkin|nötter|nöt)/u, "nut_free"],
  [/^(?:sesame?|seesami)/u, "sesame_free"],
  [/^(?:eggs?|kananmun|muna|ägg)/u, "egg_free"],
  [/^(?:fish|kala|fisk)/u, "fish_free"],
  [/^(?:soy|soija|soja)/u, "soy_free"],
  [/^(?:milk|dairy|maito|maido|mjölk)/u, "milk_free"],
  [/^(?:gluten|gluteeni)/u, "gluten_free"],
  [/^(?:lactose|laktoosi|laktos)/u, "lactose_free"],
  [/^(?:meat|liha|kött)/u, "vegetarian"],
];

const NO_LIST = /(?:^|[^\p{L}])(?:no|without|ei|ilman|utan)\s+([^.;!?]+)/gu;
const LIST_SPLIT = /,|\s(?:or|and|nor|tai|ja|eikä|och|eller)\s/u;
/** "gluteeniton", "laktoosittomat", "pähkinätön": the stem before the Finnish "without" ending. */
const WITHOUT_ENDING = /^(\p{L}+?)(?:ton|tön|ttom\p{L}*|ttöm\p{L}*)$/u;

function namedBy(head: string): DietaryNeed | undefined {
  return NAMED_AFTER_NO.find(([pattern]) => pattern.test(head))?.[1];
}

/** Needs read from Finnish words ending in -ton or -tön: "munaton", "kalattomat". */
function namedByEnding(tokens: string[]): DietaryNeed[] {
  return tokens.flatMap((token) => {
    const stem = token.match(WITHOUT_ENDING)?.[1];
    const need = stem ? namedBy(stem) : undefined;
    return need ? [need] : [];
  });
}

/** Needs named in a list after "no": each item counts, not only the first. */
function namedAfterNo(lower: string): DietaryNeed[] {
  return [...lower.matchAll(NO_LIST)].flatMap((match) =>
    match[1].split(LIST_SPLIT).flatMap((item) => {
      const head = item.trim().split(/\s+/)[0] ?? "";
      const found = namedBy(head);
      return found ? [found] : [];
    }),
  );
}

const WORD = /[\p{L}\d][\p{L}\d.\-]*|€/gu;

function words(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).map((word) => word.replace(/[.-]+$/, ""));
}

function numberOf(word: string | undefined): number | undefined {
  if (!word) return undefined;
  if (/^\d{1,4}$/.test(word)) return Number(word);
  return NUMBER_WORDS[word];
}

/** The number at this place, unless it is money: "15 €", "€ 15", "20 euroa", "15 per". */
function countAt(tokens: string[], at: number): number | undefined {
  const value = numberOf(tokens[at]);
  if (value === undefined) return undefined;
  const after = tokens[at + 1] ?? "";
  if (MONEY_WORD.test(after) || PER_WORD.test(after) || tokens[at - 1] === "€") return undefined;
  return value;
}

/** A count next to a guest word ("80 guests", "80 hengen", "for 80 people"), else a number after "for". Prices never count. */
function readGuests(tokens: string[]): number | undefined {
  for (const [at, token] of tokens.entries()) {
    // "per guest" and "hengeltä" name a rate, not the people.
    if (!GUEST_WORD.test(token) || PER_WORD.test(token) || PER_WORD.test(tokens[at - 1] ?? "")) continue;
    const count = countAt(tokens, at - 1) ?? countAt(tokens, at - 2) ?? countAt(tokens, at + 1);
    if (count) return count;
  }
  const afterFor = tokens.findIndex((token, at) => (token === "for" || token === "för") && countAt(tokens, at + 1) !== undefined);
  return afterFor >= 0 ? countAt(tokens, afterFor + 1) : undefined;
}

/** "15 € per guest", "alle 20 euroa hengeltä", "budget 18 euros": net EUR per guest. */
export function readBudget(words: string): number | undefined {
  const lower = words.toLowerCase();
  const match =
    lower.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|eur\p{L}*)\s*(?:\/|per|a|hengeltä|hlö|henkeä|per guest|vieraalta|vierasta kohden|\/hlö|\/vieras)/u) ??
    lower.match(/(?:budget|budjetti|alle|under|max(?:imum)?|enintään)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|eur\p{L}*)/u);
  if (!match) return undefined;
  const value = Number(match[1].replace(",", "."));
  return value > 0 && value < 500 ? value : undefined;
}

function readDate(tokens: string[], today: string): string | undefined {
  for (const [at, token] of tokens.entries()) {
    // "tänä iltana" is tonight; "tänä perjantaina" is this Friday, read by its weekday.
    if (token === "tänä" && tokens[at + 1] === "iltana") return today;
    if (/^\d{4}-\d{2}-\d{2}$/.test(token) && isValidDate(token)) return token;
    const finnish = token.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
    if (finnish) {
      const year = finnish[3] ?? today.slice(0, 4);
      const date = `${year}-${finnish[2].padStart(2, "0")}-${finnish[1].padStart(2, "0")}`;
      if (isValidDate(date)) return !finnish[3] && date < today ? `${Number(year) + 1}${date.slice(4)}` : date;
    }
    for (const [pattern, weekday] of WEEKDAYS) if (pattern.test(token)) return nextWeekday(today, weekday);
    for (const [pattern, days] of RELATIVE) if (pattern.test(token)) return addDays(today, days);
  }
  return undefined;
}

function firstMatch<T>(text: string, table: [RegExp, T][]): T | undefined {
  return table.find(([pattern]) => pattern.test(text))?.[1];
}

/** Reads guests, date, occasion, dietary needs and courses from English or Finnish words, by rule. */
export function readEventWords(text: string, today: string): ReadEvent {
  const lower = text.toLowerCase();
  const tokens = words(text);
  const dietary = [...NEEDS.filter(([pattern]) => pattern.test(lower)).map(([, need]) => need), ...namedAfterNo(lower), ...namedByEnding(tokens)];
  // "no peanuts" also reads as a nut rule; keep only the peanut rule unless nuts are named on their own.
  const nutsNamedAlone = /\b(?:nuts?\b|pähkinä)/u.test(lower.replace(/peanuts?|maapähkinä\p{L}*/gu, ""));
  const needs = dietary.filter((need) => need !== "nut_free" || !dietary.includes("peanut_free") || nutsNamedAlone);
  return {
    guests: readGuests(tokens),
    date: readDate(tokens, today),
    occasion: firstMatch(lower, OCCASIONS),
    dietary: [...new Set(needs)],
    courses: firstMatch(lower, COURSE_COUNT),
    budgetPerGuest: readBudget(text),
  };
}
