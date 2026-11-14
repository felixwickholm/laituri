import type { Course, Occasion } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import { recipeAllergens, recipeLabels } from "../derive";
import { ROLES, WORDS } from "../roles";
import type { ProductWords } from "../types";
import { allergensOf, BASICS, kindOf, lexiconEntry, roleIn } from "./lexicon";
import type { Bucket } from "./select";
import { englishTitle } from "./titles";
import type { IngredientMatch, ValioIngredient, ValioRecipe } from "./types";

/** The fields of a page's schema.org Recipe the import reads. The method text is never read. */
export interface RawRecipe {
  name?: string;
  recipeIngredient?: string[];
  recipeYield?: string;
  recipeCategory?: string;
  keywords?: string;
  image?: string[] | string;
  datePublished?: string;
}

/** A whole cake is cut into slices of this weight; our assumption, the pages give cakes as pieces. */
export const SLICE_KG = 0.12;
/** A piece up to this weight is one portion (a pastry, a cream puff, a meat pie). */
const PORTION_PIECE_KG = 0.5;
/**
 * A dessert piece heavier than this is a whole cake or a tray bake, not one portion: a dessert portion is about a
 * slice (SLICE_KG). Counting such pieces as portions put three to four times too much dessert on the list.
 */
export const DESSERT_PIECE_KG = 0.15;
/** Share of the non-basic ingredients, by weight, that must match a product for the planner to use the recipe. */
export const PLANNABLE_SHARE = 0.7;
/** Fewer portions than this is a part of a dish (a filling, a batter), not a dish. */
const MIN_SERVES = 4;
/** Parts of dishes and bakery items: not a course a menu serves. */
export const NOT_A_DISH = /tayte$|massa|taikina|levite|piparit|sampyla|pulla|pitko|leipa|limppu|kiekko|wiener|solmu|kerma$|juoma$|smoothie|kahvi$/;

/** Valio's category and course tags, first match wins. */
const COURSE_BY_CATEGORY: [RegExp, Course][] = [
  [/jälkiruoat|makeat? leivonnaiset/, "dessert"],
  [/alkuruoat/, "starter"],
  [/pääruoat|vuokaruoka|vuokaruoat|keitot|street food|liharuoat|kala- ja äyriäisruoat|broilerireseptit/, "main"],
  [/lisäkeruoat|salaatit/, "side"],
];

/** A sauce alone is part of a dish, not a course. */
const SAUCE_ONLY = /kastikkeet/;
/** A savoury bake Valio files under sides (a blini pancake): on a menu it is a starter, not the side of a main. */
const SAVOURY_BAKE = /suolaiset leivonnaiset/;

function number(text: string): number {
  return Number(text.replace(",", "."));
}

/** "0,030 kg ruokaöljyä" -> 0.03 kg of "ruokaöljyä". Every line on the professional pages is in kg. */
export function parseLine(line: string): { kg?: number; name: string } {
  const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g)\s+(.+)$/i);
  if (!match) return { name: line.trim().toLowerCase() };
  const amount = number(match[1]) * (match[2].toLowerCase() === "g" ? 0.001 : 1);
  return { kg: amount, name: match[3].trim().toLowerCase() };
}

/** Portions from the yield: "16, 16 annosta" -> 16; "8, 8 kpl" cakes -> slices by weight; loaves are not portions. */
export function portions(yieldText: string, totalKg: number, course: Course, title: string): number | undefined {
  const match = yieldText.match(/(\d+)\s*(annosta|annos|kpl|hengelle)/);
  if (!match) return undefined;
  const count = Number(match[1]);
  if (match[2] !== "kpl") return count;
  if (/leipä|limppu|leipä$/.test(title.toLowerCase())) return undefined;
  const piece = totalKg / count;
  if (course === "dessert") return piece <= DESSERT_PIECE_KG ? count : Math.round(totalKg / SLICE_KG);
  return piece <= PORTION_PIECE_KG ? count : undefined;
}

/**
 * A yeast dough or pastry dish: its flour is the dough, not a thickener, and nothing stands in for it. Read from the
 * yeast in the lines or the dish's name: pizza, bread, pulla, pie.
 */
const DOUGH_DISH = /pizza|calzone|focaccia|pinsa|leipä|leipa|pulla|pitko|sämpylä|sampyla|piirak|piiras|rieska|munkki|kranssi|pasteij|lihapii/;

export function isDough(slug: string, title: string, lines: string[]): boolean {
  return DOUGH_DISH.test(`${slug} ${title.toLowerCase()}`) || lines.some((line) => /\bhiiva|kuivahiiva|tuorehiiva/.test(parseLine(line).name));
}

function courseOf(raw: RawRecipe, tags: string[], bucket: Bucket): Course | undefined {
  const category = `${raw.recipeCategory ?? ""} | ${tags.join(" | ")}`.toLowerCase();
  if (bucket.id === "cream-cake") return "dessert";
  if (bucket.id === "dessert" && !/alkuruoat|pääruoat/.test(category)) return "dessert";
  if (bucket.id === "side" && /lisäke|salaati/.test(category)) return "side";
  for (const [pattern, course] of COURSE_BY_CATEGORY) {
    if (!pattern.test(category)) continue;
    return course === "side" && SAVOURY_BAKE.test(category) ? "starter" : course;
  }
  return SAUCE_ONLY.test(category) ? undefined : bucket.course;
}

/** Seasons Valio tags the recipe for: talvi, syksy, kevät, kesä, joulu. */
function seasonsOf(tags: string[]): string[] {
  const text = tags.join(" ").toLowerCase();
  return ["joulu", "talvi", "syksy", "kevät", "kesä"].filter((season) => text.includes(season));
}

/**
 * Everyday food: fine for lunch or a buffet, never on a wedding or Christmas menu, whatever its tags say ("kesäjuhlat"
 * lands on pizzas and mince sauces too).
 */
const EVERYDAY = /pizza|kebab|nacho|burger|hampurilai|hodari|wrap|tortilla|nugget|makaroni|jauhelihakastike|lihakastike/;

function occasionsOf(tags: string[], title: string, bucket: Bucket, course: Course, slug = ""): Occasion[] {
  const found = new Set<Occasion>(bucket.occasions);
  const text = `${tags.join(" ")} ${title}`.toLowerCase();
  if (/joulu|juhla|hää|uusivuosi/.test(text)) found.add("celebration");
  const everyday = EVERYDAY.test(`${slug} ${title.toLowerCase()}`) || /street food/.test(text);
  if (everyday && !/joulu/.test(text)) found.delete("celebration");
  if (/noutopöytä|buffet|bufee|kokoustarjoilut/.test(text)) found.add("buffet");
  if (/aamiai|aamupala|brunssi|puuro/.test(text)) found.add("breakfast");
  if (/koulu|päiväkoti|lounas|suurille ammattikeittiöille/.test(text) && course !== "dessert") found.add("lunch");
  return [...found];
}

/** Catalogue words for a lexicon entry. */
function wordsFor(entry: NonNullable<ReturnType<typeof lexiconEntry>>): ProductWords | undefined {
  return entry.key ? WORDS[entry.key] : entry.words;
}

function lexiconMatch(name: string, course: Course, sweet: boolean, catalog: Pick<Catalog, "search">, dough = false): IngredientMatch | "none" | undefined {
  const entry = lexiconEntry(name);
  if (!entry) return undefined;
  if (entry.none) return "none";
  const spec = wordsFor(entry);
  if (!spec) return "none";
  const product = firstProduct(spec, catalog);
  if (!product) return "none";
  return {
    words: spec.words,
    ...(spec.claims ? { claims: spec.claims } : {}),
    ...(spec.nameHas ? { nameHas: spec.nameHas } : {}),
    ...(entry.key ? { key: entry.key } : {}),
    role: roleIn(entry, course, sweet, dough),
    productId: product.id,
    productName: product.name.en || product.name.fi,
    confidence: entry.close ? "medium" : "high",
    how: "lexicon",
  };
}

/** The first product the words find that carries the claims and name words: what the planner would consider. */
function firstProduct(spec: ProductWords, catalog: Pick<Catalog, "search">) {
  const { hits } = catalog.search({ query: spec.words, filters: spec.claims ? { claims: spec.claims } : undefined, limit: 20 });
  return hits.map((hit) => hit.product).find((product) => (spec.nameHas ?? []).every((part) => product.name.en.toLowerCase().includes(part)));
}

function ingredient(line: string, course: Course, sweet: boolean, lactoseFree: boolean, catalog: Pick<Catalog, "search">, dough = false): ValioIngredient {
  const { kg, name } = parseLine(line);
  const allergens = allergensOf(name, lactoseFree);
  const base: ValioIngredient = { asWritten: line.trim(), name, allergens, kind: kindOf(name, allergens) };
  if (BASICS.test(name) && !lexiconEntry(name)?.key) return { ...base, basic: true };
  const entry = lexiconEntry(name);
  const unit = entry?.unit ?? "kg";
  if (kg) base.quantity = { amount: Math.round(kg * 1000) / 1000, unit };
  const lexicon = lexiconMatch(name, course, sweet, catalog, dough);
  const match = lexicon === "none" ? undefined : lexicon;
  if (!match) return { ...base, unmatched: "Not in the recorded catalogue." };
  // The ingredient declares what the product brings too, so a dish's allergens hold whatever product is bought.
  const withProduct = { ...base, allergens: [...new Set([...allergens, ...(lexicon && lexicon !== "none" ? (wordsFor(lexiconEntry(name)!)?.allergens ?? []) : [])])].sort(), match };
  if (!kg) return { ...withProduct, unmatched: "No amount in kg." };
  if (match.confidence === "low") return { ...withProduct, unmatched: "Only a low-confidence product match." };
  return withProduct;
}

const COURSE_WORD: Record<Course, string> = { starter: "Starter", main: "Main", side: "Side", dessert: "Dessert", drink: "Drink" };

/** One line in our own words: course, portions, and what most of the weight is. */
function summaryOf(course: Course, serves: number, lines: ValioIngredient[]): string {
  const main = [...lines]
    .filter((line) => line.match && !line.unmatched && line.quantity)
    .sort((a, b) => b.quantity!.amount - a.quantity!.amount)
    .map((line) => line.match!.words.replace(/^lactose-free /, ""));
  const top = [...new Set(main)].slice(0, 3);
  const list = top.length > 1 ? `${top.slice(0, -1).join(", ")} and ${top.at(-1)}` : top[0];
  return list ? `${COURSE_WORD[course]} for ${serves}, built on ${list}.` : `${COURSE_WORD[course]} for ${serves}.`;
}

/** Share of the weight of non-basic lines that has a usable product. */
export function matchedShare(lines: ValioIngredient[]): number {
  const weighed = lines.filter((line) => !line.basic);
  const weight = (line: ValioIngredient) => line.quantity?.amount ?? 0;
  const all = weighed.reduce((sum, line) => sum + weight(line), 0);
  const matched = weighed.filter((line) => line.match && !line.unmatched).reduce((sum, line) => sum + weight(line), 0);
  return all > 0 ? matched / all : 0;
}

/** One Valio Aimo recipe page, read into the library's shape; undefined when it gives no portions or no ingredients. */
export function importRecipe(slug: string, url: string, raw: RawRecipe, bucket: Bucket, catalog: Pick<Catalog, "search">): ValioRecipe | undefined {
  const title = String(raw.name ?? "").trim();
  const lines = (raw.recipeIngredient ?? []).filter((line) => typeof line === "string" && line.trim());
  if (!title || !lines.length || NOT_A_DISH.test(slug)) return undefined;
  const tags = String(raw.keywords ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const course = courseOf(raw, tags, bucket);
  if (!course) return undefined;
  const totalKg = lines.reduce((sum, line) => sum + (parseLine(line).kg ?? 0), 0);
  const serves = portions(String(raw.recipeYield ?? ""), totalKg, course, title);
  if (!serves || serves < MIN_SERVES) return undefined;
  const sweet = course === "dessert" || /leivonnai|kakku/.test(`${raw.recipeCategory} ${title}`.toLowerCase());
  const lactoseFree = tags.some((tag) => /^laktoositon$/.test(tag));
  const dough = isDough(slug, title, lines);
  const ingredients = lines.map((line) => ingredient(line, course, sweet, lactoseFree, catalog, dough));
  for (const line of ingredients) if (line.match) line.match.role = ROLES[line.match.role as keyof typeof ROLES] ? line.match.role : "as_written";
  const image = Array.isArray(raw.image) ? raw.image[0] : raw.image;
  return {
    id: `valio-${slug}`,
    slug,
    title: { fi: title, en: englishTitle(slug, title) },
    url,
    ...(image ? { image } : {}),
    serves,
    yieldText: String(raw.recipeYield ?? ""),
    course,
    occasions: occasionsOf(tags, title, bucket, course, slug),
    tags,
    seasons: seasonsOf(tags),
    labels: recipeLabels(ingredients),
    allergens: recipeAllergens(ingredients),
    summary: summaryOf(course, serves, ingredients),
    ingredients,
    plannable: matchedShare(ingredients) >= PLANNABLE_SHARE,
    bucket: bucket.id,
  };
}
