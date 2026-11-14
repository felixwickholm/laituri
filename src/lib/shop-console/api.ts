import type { Product, SearchRequest, SearchResponse } from "@/lib/contracts";
import { ApiError } from "@/lib/console/api";

/**
 * The shop searches through the same public routes an agent calls. It names itself, so the record says a person
 * searched. Orders go through the basket store, the same path the weekly order and the menu planner use.
 */
const CALLER = { "x-agent-name": "A person in the shop", "x-agent-client": "Laituri shop" };

async function call<T>(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(CALLER)) headers.set(name, value);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, cache: "no-store", credentials: "same-origin" });
  const body = (await response.json().catch(() => undefined)) as unknown;
  if (!response.ok) {
    const problem = (body ?? {}) as { detail?: unknown; code?: unknown };
    const detail = typeof problem.detail === "string" ? problem.detail : `The server answered ${response.status}.`;
    throw new ApiError(response.status, detail, typeof problem.code === "string" ? problem.code : undefined, body);
  }
  return body as T;
}

export const shopApi = {
  search: (request: SearchRequest, signal?: AbortSignal) =>
    call<SearchResponse>("/api/v1/products/search", { method: "POST", body: JSON.stringify(request), signal }),
  product: (id: string) => call<Product>(`/api/v1/products/${encodeURIComponent(id)}`),
};
