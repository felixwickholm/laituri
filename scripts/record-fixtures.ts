/**
 * Records one live price and availability answer for a curated product list into fixtures/upstream,
 * so recorded mode, tests and evals replay real wholesaler data through the same normaliser.
 * Usage: npx tsx scripts/record-fixtures.ts [--date YYYY-MM-DD]
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Product } from "../src/lib/contracts";
import { createCatalog } from "../src/lib/catalog";
import { loadProducts } from "../src/lib/catalog/load";
import { now } from "../src/lib/clock";
import { configFromEnv, fetchRawAvailability, fetchRawPrices } from "../src/lib/valio/http";

if (existsSync(".env")) process.loadEnvFile(".env");

/** Every product of these concepts is recorded: the core of the demo and the tests. */
const FULL_CONCEPTS = ["milk", "coffee_milk", "whipping_cream", "oat_drink"];
/** The best few products of these concepts, as search ranks them. */
const SAMPLED_CONCEPTS = [
  "cooking_cream", "buttermilk", "sour_cream", "yogurt", "quark", "butter", "margarine", "soy_drink", "plant_drink",
  "cheese", "grated_cheese", "cream_cheese", "eggs", "chicken", "minced_meat", "salmon", "white_fish", "potatoes",
  "onion", "carrot", "tomato", "rice", "pasta", "flour", "oats", "sugar", "coffee", "tea", "rapeseed_oil", "bread",
];
const PER_SAMPLED_CONCEPT = 4;
/** Products the scenarios rely on by id. */
const NAMED_IDS = ["464306", "464401", "463335", "464201", "464073", "464398", "465039", "462775"];
const FIXTURES = path.join(process.cwd(), "fixtures", "upstream");

function nextMonday(): string {
  const date = now();
  do date.setDate(date.getDate() + 1);
  while (date.getDay() !== 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function curate(products: Product[]): Product[] {
  const catalog = createCatalog(products);
  const ids = new Set(NAMED_IDS);
  for (const p of products) if (p.concept && FULL_CONCEPTS.includes(p.concept)) ids.add(p.id);
  for (const concept of SAMPLED_CONCEPTS) {
    const query = concept.replace(/_/g, " ");
    for (const hit of catalog.search({ query, limit: PER_SAMPLED_CONCEPT }).hits) ids.add(hit.product.id);
  }
  for (const id of [...ids]) for (const sub of catalog.get(id)?.substitutes ?? []) if (catalog.get(sub)) ids.add(sub);
  return [...ids].sort().map((id) => catalog.get(id)).filter((p): p is Product => p !== undefined);
}

/** One product per line keeps the files compact and their diffs readable. */
function keyedLines(entries: [string, unknown][]): string {
  return entries.map(([id, value]) => `${JSON.stringify(id)}:${JSON.stringify(value)}`).join(",\n");
}

async function main(): Promise<void> {
  const config = configFromEnv();
  if (!config) throw new Error("VALIO_API_KEY is not set. Add it to .env first.");
  const dateFlag = process.argv.indexOf("--date");
  const date = dateFlag > 0 ? process.argv[dateFlag + 1] : nextMonday();
  const customer = process.env.VALIO_CUSTOMER || "123";
  const products = curate(loadProducts());
  const ids = products.map((p) => p.id);
  console.log(`Recording ${ids.length} products for delivery on ${date} ...`);

  const [prices, stock] = await Promise.all([
    fetchRawPrices(config, ids, date, customer),
    fetchRawAvailability(config, ids, date, customer),
  ]);
  const meta = { recordedAt: now().toISOString(), requestedDate: date, customer };
  const fixture = (rows: { productId: string }[]) =>
    `{"meta":${JSON.stringify(meta)},\n"products":{\n${keyedLines(rows.map((r) => [r.productId, r]))}\n}}\n`;

  await mkdir(FIXTURES, { recursive: true });
  await writeFile(path.join(FIXTURES, "price.json"), fixture(prices));
  await writeFile(path.join(FIXTURES, "availability.json"), fixture(stock));
  await writeFile(path.join(FIXTURES, "catalog.json"), `[\n${products.map((p) => JSON.stringify(p)).join(",\n")}\n]\n`);
  console.log(`Wrote price.json, availability.json and catalog.json to ${path.relative(process.cwd(), FIXTURES)}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
