import type { Order, SuspensionState } from "@/lib/contracts";
import { ApiError } from "@/lib/console/api";
import type { Activity } from "@/lib/store/types";
import type { ControlOverview, ScenarioRun } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw await failure(response);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await failure(response);
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function failure(response: Response): Promise<ApiError> {
  let detail = `The server answered ${response.status}.`;
  let code: string | undefined;
  try {
    const body = (await response.json()) as { detail?: unknown; code?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
    if (typeof body.code === "string") code = body.code;
  } catch {
    // A body that is not JSON keeps the generic sentence.
  }
  return new ApiError(response.status, detail, code);
}

/** The wholesaler's reads and its one control. Every call is made as a console visitor, never with an agent token. */
export const supplierApi = {
  overview: () => getJson<ControlOverview>("/api/v1/supplier/overview"),
  activity: async (buyerId: string) =>
    (await getJson<{ activity: Activity[] }>(`/api/v1/activity?buyer=${encodeURIComponent(buyerId)}`)).activity ?? [],
  orders: async (buyerId: string) => (await getJson<{ orders: Order[] }>(`/api/v1/orders?buyer=${encodeURIComponent(buyerId)}`)).orders ?? [],
  suspend: (agentId: string, suspended: boolean, reason?: string) =>
    postJson<SuspensionState>(`/api/v1/supplier/agents/${encodeURIComponent(agentId)}/suspension`, reason ? { suspended, reason } : { suspended }),
  startTwoKitchens: () => postJson<{ runId: string }>("/api/v1/demo/runs", { scenario: "two-kitchens" }),
  run: (runId: string) => getJson<ScenarioRun>(`/api/v1/demo/runs/${encodeURIComponent(runId)}`),
};
