/**
 * Imports professional recipes from Valio Aimo (valioaimo.fi/reseptit) into src/lib/recipes/valio/recipes.json.
 *
 * Source: the public recipe sitemaps and each page's schema.org Recipe (JSON-LD). robots.txt allows /reseptit/.
 * Polite: one request at a time with a pause, pages cached in .data/recipes-cache so a re-run fetches only what is new.
 * Kept per recipe: title, source URL, portions, ingredients as written, image link, Valio's own tags, and derived
 * facts (course, occasions, allergens, diet labels, catalogue matches). The method text is not stored.
 *
 * Usage: npx tsx scripts/recipes-import.ts [--offline]   (--offline uses the cache only)
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fixtureCatalog } from "../src/lib/catalog";
import { BUYER_IDS, defaultMandate } from "../src/lib/mandate";
import { costPerPortion, plausibleCost } from "../src/lib/menu/cost";
import { RecordedUpstream } from "../src/lib/valio";
import { valioDef } from "../src/lib/recipes/valio";
import { importRecipe, type RawRecipe } from "../src/lib/recipes/valio/build";
import { BUCKETS, MAX_RECIPES } from "../src/lib/recipes/valio/select";
import type { ValioFile, ValioRecipe } from "../src/lib/recipes/valio/types";

const SITE = "https://www.valioaimo.fi";
const SITEMAPS = ["vl_recipe-sitemap.xml", "vl_recipe-sitemap2.xml", "vl_recipe-sitemap3.xml"];
const CACHE = path.join(process.cwd(), ".data", "recipes-cache");
const OUT = path.join(process.cwd(), "src", "lib", "recipes", "valio", "recipes.json");
const PAUSE_MS = 1200;
const AGENT = "Laituri recipe import (Junction 2026 demo; one request at a time)";
/** Pages fetched at most: some carry no portions and are skipped. */
const FETCH_BUDGET = 175;

const offline = process.argv.includes("--offline");
const fetchOnly = process.argv.includes("--fetch-only");

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "user-agent": AGENT, accept: "text/html,application/xml" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function slugs(): Promise<string[]> {
  const file = path.join(CACHE, "_slugs.json");
  if (offline || existsSync(file)) {
    if (existsSync(file)) return JSON.parse(await readFile(file, "utf8")) as string[];
  }
  const all: string[] = [];
  for (const map of SITEMAPS) {
    const xml = await get(`${SITE}/${map}`);
    for (const match of xml.matchAll(/<loc>https:\/\/www\.valioaimo\.fi\/reseptit\/([^/<]+)\/<\/loc>/g)) all.push(match[1]);
    await pause(PAUSE_MS);
  }
  const unique = [...new Set(all)].sort();
  await writeFile(file, JSON.stringify(unique));
  return unique;
}

/** The page's schema.org Recipe, without the method text. */
function recipeLd(html: string): RawRecipe | undefined {
  for (const match of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(match[1]) as Record<string, unknown>;
      if (data["@type"] !== "Recipe") continue;
      const { name, recipeIngredient, recipeYield, recipeCategory, keywords, image, totalTime, cookTime, prepTime, datePublished } = data;
      return { name, recipeIngredient, recipeYield, recipeCategory, keywords, image, totalTime, cookTime, prepTime, datePublished } as RawRecipe;
    } catch {
      continue;
    }
  }
  return undefined;
}

async function page(slug: string): Promise<RawRecipe | undefined | "missing"> {
  const file = path.join(CACHE, `${slug}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8")) as RawRecipe | "missing";
  if (offline) return undefined;
  let found: RawRecipe | "missing";
  try {
    found = recipeLd(await get(`${SITE}/reseptit/${slug}/`)) ?? "missing";
  } catch (error) {
    console.warn(String(error));
    found = "missing";
  }
  await writeFile(file, JSON.stringify(found));
  await pause(PAUSE_MS);
  return found;
}

/** Recipes in bucket order: each bucket takes its quota of the slugs it matches, shortest (most classic) names first. */
function selection(all: string[]): string[][] {
  const taken = new Set<string>();
  return BUCKETS.map((bucket) => {
    const matching = all
      .filter((slug) => !taken.has(slug) && bucket.match.test(slug) && !/testi|hybridi|kylmavalmist/.test(slug))
      .sort((a, b) => (bucket.prefer?.test(b) ? 1 : 0) - (bucket.prefer?.test(a) ? 1 : 0) || a.length - b.length || a.localeCompare(b));
    const picked = matching.slice(0, Math.ceil(bucket.quota * 1.6));
    picked.forEach((slug) => taken.add(slug));
    return picked;
  });
}

/** The recorded wholesaler answers' day and delivery, as the tests use them. */
const RECORDED_NOW = new Date("2026-11-14T09:00:00+02:00");
const RECORDED_DELIVERY = "2026-11-20";
const COST_GUESTS = 80;

/**
 * Prices each plannable recipe for 80 guests at the recorded prices. One whose food cost per portion is outside the
 * plausible range for its course is not planned: its main ingredients are missing from the catalogue.
 */
async function checkCosts(recipes: ValioRecipe[], catalog: ReturnType<typeof fixtureCatalog>): Promise<void> {
  const costs = await costPerPortion(
    recipes.filter((recipe) => recipe.plannable).map(valioDef),
    COST_GUESTS,
    { catalog, upstream: new RecordedUpstream(), mandate: defaultMandate(BUYER_IDS.nordicHarbour), now: RECORDED_NOW, deliverBy: RECORDED_DELIVERY },
  );
  for (const recipe of recipes) {
    const cost = costs.get(recipe.id);
    if (cost === undefined) continue;
    recipe.costPerPortion = cost;
    if (!plausibleCost(recipe.course, cost)) recipe.plannable = false;
  }
}

async function main(): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  const all = await slugs();
  const catalog = fixtureCatalog();
  const recipes: ValioRecipe[] = [];
  let fetched = 0;
  const groups = selection(all);
  for (const [at, group] of groups.entries()) {
    const bucket = BUCKETS[at];
    let kept = 0;
    for (const slug of group) {
      if (kept >= bucket.quota || recipes.length >= MAX_RECIPES) break;
      const cached = existsSync(path.join(CACHE, `${slug}.json`));
      if (!cached && fetched >= FETCH_BUDGET) break;
      const raw = await page(slug);
      if (!cached) fetched += 1;
      if (!raw || raw === "missing") continue;
      if (fetchOnly) {
        kept += 1;
        continue;
      }
      const recipe = importRecipe(slug, `${SITE}/reseptit/${slug}/`, raw, bucket, catalog);
      if (!recipe) continue;
      recipes.push(recipe);
      kept += 1;
    }
    console.log(`${bucket.id}: ${kept} of ${bucket.quota}`);
  }
  await checkCosts(recipes, catalog);
  const ingredients = recipes.flatMap((recipe) => recipe.ingredients.filter((line) => !line.basic));
  const matched = ingredients.filter((line) => line.match);
  const file: ValioFile = {
    source: { name: "Valio", site: `${SITE}/reseptit/`, attribution: "Recipe: Valio" },
    importedAt: new Date().toISOString().slice(0, 10),
    matchedAgainst: "the recorded catalogue (fixtures/upstream/catalog.json)",
    stats: {
      recipes: recipes.length,
      ingredients: ingredients.length,
      matched: matched.length,
      high: matched.filter((line) => line.match?.confidence === "high").length,
      plannable: recipes.filter((recipe) => recipe.plannable).length,
    },
    recipes,
  };
  // One recipe per line: small, and a re-run shows as a readable diff.
  const { recipes: list, ...head } = file;
  const body = list.map((recipe) => JSON.stringify(recipe)).join(",\n");
  await writeFile(OUT, `${JSON.stringify(head).slice(0, -1)},"recipes":[\n${body}\n]}\n`);
  console.log(`${recipes.length} recipes, ${matched.length} of ${ingredients.length} ingredients matched, ${file.stats.plannable} plannable. Fetched ${fetched} pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
