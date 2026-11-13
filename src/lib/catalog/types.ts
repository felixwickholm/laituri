import type { Product, SearchRequest, SearchResponse } from "@/lib/contracts";

export interface Catalog {
  size: number;
  get(id: string): Product | undefined;
  search(request: SearchRequest): SearchResponse;
  /** Static substitute candidates, best first: wholesaler-listed substitutes, then same concept and category. */
  substitutesFor(id: string, limit?: number): Product[];
}
