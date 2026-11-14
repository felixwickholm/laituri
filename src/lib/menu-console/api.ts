import { ApiError } from "@/lib/console/api";
import type { CreateBasketRequest, MenuPlan, PlanRequest, Recipe, RecipeSummary, Suggestion } from "./types";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, cache: "no-store", credentials: "same-origin" });
  const isJson = response.headers.get("content-type")?.includes("json") ?? false;
  if (!response.ok || !isJson) {
    let detail = response.ok ? "This part is not ready yet." : `The server answered ${response.status}.`;
    let code: string | undefined;
    if (isJson) {
      const body = (await response.json().catch(() => ({}))) as { detail?: unknown; code?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
      if (typeof body.code === "string") code = body.code;
    }
    throw new ApiError(response.ok ? 404 : response.status, detail, code);
  }
  return (await response.json()) as T;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

/** The menu, recipe, suggestion and basket routes. Every call runs in this browser's own workspace. */
export const menuApi = {
  plan: (body: PlanRequest) => post<MenuPlan>("/api/v1/menus/plan", body),
  recipes: async () => (await call<{ recipes: RecipeSummary[] }>("/api/v1/recipes")).recipes ?? [],
  recipe: (id: string) => call<Recipe>(`/api/v1/recipes/${encodeURIComponent(id)}`),
  suggestions: async () => (await call<{ suggestions: Suggestion[] }>("/api/v1/suggestions")).suggestions ?? [],
  placeBasket: (body: CreateBasketRequest) => post<{ basketId: string }>("/api/v1/baskets", body),
  startWeekly: () => post<{ basketId: string }>("/api/v1/baskets/weekly", {}),
};

/** True when the route itself is missing, so a screen can stay quiet instead of showing an error. */
export function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function isLocked(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
