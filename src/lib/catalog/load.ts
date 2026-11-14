import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Product } from "@/lib/contracts";

/** The full index built by `npm run setup`, unless LAITURI_CATALOG points elsewhere. */
export function catalogPath(): string {
  return process.env.LAITURI_CATALOG ?? path.join(process.cwd(), ".data", "catalog.json");
}

/** Slim index of the recorded products, committed with the upstream fixtures. */
export function fixtureCatalogPath(): string {
  return path.join(process.cwd(), "fixtures", "upstream", "catalog.json");
}

let cached: { file: string; products: Product[] } | undefined;

export function readProductFile(file: string): Product[] {
  return JSON.parse(readFileSync(file, "utf8")) as Product[];
}

/**
 * Reads the product index once. In recorded mode without a built index, the committed fixture index is used,
 * so tests and demos work on a fresh checkout.
 */
export function loadProducts(): Product[] {
  let file = catalogPath();
  if (!existsSync(file) && process.env.VALIO_MODE === "recorded" && !process.env.LAITURI_CATALOG) {
    file = fixtureCatalogPath();
  }
  if (cached?.file === file) return cached.products;
  if (!existsSync(file)) {
    throw new Error(`The product catalog is missing at ${file}. Run: npm run setup`);
  }
  const products = readProductFile(file);
  cached = { file, products };
  return products;
}
