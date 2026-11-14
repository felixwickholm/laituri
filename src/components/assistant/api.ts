import type { AssistantTurn, AssistantTurnRequest, CreateBasketRequest, Recipe } from "@/lib/contracts";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init.body ? { "content-type": "application/json" } : undefined,
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => ({}))) as { detail?: unknown };
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : `The server answered ${response.status}.`);
  return body as T;
}

/** The assistant, recipe and basket routes, in this browser's own workspace. */
export const assistantApi = {
  turn: (body: AssistantTurnRequest) => call<AssistantTurn>("/api/v1/assistant/turn", { method: "POST", body: JSON.stringify(body) }),
  placeBasket: (body: CreateBasketRequest) => call<{ basketId: string }>("/api/v1/baskets", { method: "POST", body: JSON.stringify(body) }),
  recipe: (id: string) => call<Recipe & { source?: unknown; sourceUrl?: unknown }>(`/api/v1/recipes/${encodeURIComponent(id)}`),
};
