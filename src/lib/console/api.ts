import type { ApprovalDecisionRequest, AuditEntry, Order, SignedOffer } from "@/lib/contracts";
import type { MandatePatch } from "@/lib/orders/types";
import type { Activity, ConsoleSession, DemoRun, Health, Jwks, Scenario, SessionRole, SignInCredentials, SignedMandate, WorkspaceInfo } from "./types";

/** Thrown for any non-2xx answer. `detail` is the server's plain sentence and `code` its machine code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly code?: string,
  ) {
    super(detail);
  }
}

export const SIGN_IN_REQUIRED = "approver_sign_in_required";
export const OPERATOR_SIGN_IN_REQUIRED = "operator_sign_in_required";
export const SHARED_READ_ONLY = "shared_read_only";
export const WRONG_PASSCODE = "wrong_passcode";

/** The one fetch every console call goes through. The approver session travels as a same-origin cookie. */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    let detail = `The server answered ${response.status}.`;
    let code: string | undefined;
    try {
      const body = (await response.json()) as { detail?: unknown; code?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
      if (typeof body.code === "string") code = body.code;
    } catch {
      // A body that is not JSON keeps the generic sentence.
    }
    throw new ApiError(response.status, detail, code);
  }
  return response;
}

async function getJson<T>(path: string): Promise<T> {
  return (await request(path)).json() as Promise<T>;
}

/** Returns the raw text so the poller can skip work when nothing changed. */
async function getText(path: string): Promise<string> {
  return (await request(path)).text();
}

async function send<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const response = await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Lists arrive wrapped (`{ orders: [...] }`); a bare array is accepted too. */
function unwrap<T>(text: string, key: string): T[] {
  const body = JSON.parse(text) as unknown;
  if (Array.isArray(body)) return body as T[];
  const list = (body as Record<string, unknown> | null)?.[key];
  return Array.isArray(list) ? (list as T[]) : [];
}

export const api = {
  activityText: () => getText("/api/v1/activity"),
  ordersText: () => getText("/api/v1/orders"),
  /** Another buyer's orders, read as the wholesaler reads them; no agent call is recorded. */
  ordersOf: async (buyerId: string) => unwrap<Order>(await getText(`/api/v1/orders?buyer=${encodeURIComponent(buyerId)}`), "orders"),
  auditText: () => getText("/api/v1/audit"),
  parseActivity: (text: string) => unwrap<Activity>(text, "activity"),
  parseOrders: (text: string) => unwrap<Order>(text, "orders"),
  parseAudit: (text: string) => unwrap<AuditEntry>(text, "entries"),

  offer: (id: string) => getJson<SignedOffer>(`/api/v1/offers/${encodeURIComponent(id)}`),
  decide: (orderId: string, body: ApprovalDecisionRequest) =>
    send<Order>("POST", `/api/v1/approvals/${encodeURIComponent(orderId)}`, body),

  mandate: () => getJson<SignedMandate>("/api/v1/mandate"),
  mandateOf: (buyerId: string) => getJson<SignedMandate>(`/api/v1/mandate?buyer=${encodeURIComponent(buyerId)}`),
  updateMandate: (patch: MandatePatch) => send<SignedMandate>("PUT", "/api/v1/mandate", patch),

  session: () => getJson<ConsoleSession>("/api/v1/console/session"),
  signIn: (credentials: SignInCredentials) => send<ConsoleSession>("POST", "/api/v1/console/session", credentials),
  /** Signs out one role, or both when none is named. */
  signOut: (role?: SessionRole) => send<{ signedIn: false }>("DELETE", `/api/v1/console/session${role ? `?role=${role}` : ""}`),

  workspace: () => getJson<WorkspaceInfo>("/api/v1/workspace"),
  /** Looks at the shared workspace, read-only, or back at this browser's own sandbox. */
  setView: (view: "shared" | "sandbox") => send<WorkspaceInfo>("POST", "/api/v1/workspace/view", { view }),

  jwks: () => getJson<Jwks>("/.well-known/jwks.json"),
  health: () => getJson<Health>("/api/v1/health"),

  startRun: (body: { scenario?: Scenario; request?: string }) => send<{ runId: string }>("POST", "/api/v1/demo/runs", body),
  run: (id: string) => getJson<DemoRun>(`/api/v1/demo/runs/${encodeURIComponent(id)}`),
  tamper: () => send<{ seq: number }>("POST", "/api/v1/demo/tamper"),
  /** Puts the changed entry back as it was signed; the rest of the workspace is untouched. */
  restoreLog: () => send<{ restored: true }>("DELETE", "/api/v1/demo/tamper"),
  reset: () => send<unknown>("POST", "/api/v1/demo/reset"),
};
