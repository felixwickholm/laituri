import type { Product, SearchRequest, SearchResponse } from "@/lib/contracts";
import { loadProducts } from "./load";
import type { Entry } from "./rank";
import { search, toEntry } from "./search";
import { substitutesFor } from "./substitutes";
import type { Catalog } from "./types";

export type { Catalog } from "./types";
export { CONCEPTS, conceptById } from "./lexicon";
export { CATEGORY_GROUPS, categoryGroupLabel } from "./build/groups";

/** An in-memory catalog over a list of products. */
export function createCatalog(products: Product[]): Catalog {
  const entries: Entry[] = products.map(toEntry);
  const byId = new Map(entries.map((e) => [e.product.id, e]));
  return {
    size: entries.length,
    get: (id: string) => byId.get(id)?.product,
    search: (request: SearchRequest): SearchResponse => search(entries, request),
    substitutesFor: (id: string, limit?: number) => substitutesFor(byId, entries, id, limit),
  };
}

let instance: { products: Product[]; catalog: Catalog } | undefined;

/** The shared catalog, built lazily from the product index. */
export function catalog(): Catalog {
  const products = loadProducts();
  if (instance?.products !== products) instance = { products, catalog: createCatalog(products) };
  return instance.catalog;
}
