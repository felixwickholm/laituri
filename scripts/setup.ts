/**
 * Downloads the wholesaler's product data into .data/raw and builds the slim search index .data/catalog.json.
 * Usage: npm run setup [-- --force]
 */
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { buildIndex } from "../src/lib/catalog/build/build-index";
import type { RawProduct } from "../src/lib/catalog/build/raw-product";
import { configFromEnv } from "../src/lib/valio/http";

if (existsSync(".env")) process.loadEnvFile(".env");

const DATA_DIR = path.join(process.cwd(), ".data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
const FILES = [
  { endpoint: "/products/download", file: "products.json" },
  { endpoint: "/delivery-reliability/download", file: "delivery-reliability.csv" },
  { endpoint: "/carbon-footprint/download", file: "carbon-footprint.csv" },
];

const force = process.argv.includes("--force");

function megabytes(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

async function download(endpoint: string, target: string): Promise<void> {
  const config = configFromEnv();
  if (!config) throw new Error("VALIO_API_KEY is not set. Add it to .env and run setup again.");
  const response = await fetch(`${config.baseUrl}${endpoint}`, {
    headers: { "X-API-Key": config.apiKey },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) throw new Error(`Download of ${endpoint} failed with status ${response.status}.`);
  const partial = `${target}.partial`;
  await pipeline(Readable.fromWeb(response.body as WebReadableStream), createWriteStream(partial));
  await rename(partial, target);
}

async function main(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  for (const { endpoint, file } of FILES) {
    const target = path.join(RAW_DIR, file);
    if (existsSync(target) && !force) {
      console.log(`Using existing ${file} (${megabytes((await stat(target)).size)}).`);
      continue;
    }
    console.log(`Downloading ${file} ...`);
    await download(endpoint, target);
    console.log(`Saved ${file} (${megabytes((await stat(target)).size)}).`);
  }

  const [productsJson, reliabilityCsv, carbonCsv] = await Promise.all(
    FILES.map(({ file }) => readFile(path.join(RAW_DIR, file), "utf8")),
  );
  const products = buildIndex({ products: JSON.parse(productsJson) as RawProduct[], reliabilityCsv, carbonCsv });
  const target = path.join(DATA_DIR, "catalog.json");
  await writeFile(target, JSON.stringify(products));
  const withConcept = products.filter((p) => p.concept).length;
  console.log(`Built catalog: ${products.length} products, ${withConcept} with a concept, ${megabytes((await stat(target)).size)}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
