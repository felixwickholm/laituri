import { AUTH_HEADER, PATHS, orderBody, quoteBody, searchBody } from "./requests";

export type FlowStepId = "search" | "quote" | "mandate" | "order";

export interface FlowRequest {
  method: "GET" | "POST";
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface FlowState {
  deliverBy: string;
  idempotencyKey: string;
  offerJws?: string;
  mandateJws?: string;
}

export const FLOW_STEPS: { id: FlowStepId; label: string }[] = [
  { id: "search", label: "Search the catalogue" },
  { id: "quote", label: "Get a signed offer" },
  { id: "mandate", label: "Read the mandate" },
  { id: "order", label: "Place the order" },
];

const JSON_HEADERS = { Authorization: AUTH_HEADER, "Content-Type": "application/json" };

/** The exact request an outside agent sends for each step of the documented HTTP flow. */
export function flowRequest(step: FlowStepId, state: FlowState): FlowRequest {
  switch (step) {
    case "search":
      return { method: "POST", path: PATHS.search, headers: JSON_HEADERS, body: searchBody(state.deliverBy) };
    case "quote":
      return { method: "POST", path: PATHS.quotes, headers: JSON_HEADERS, body: quoteBody(state.deliverBy) };
    case "mandate":
      return { method: "GET", path: PATHS.mandate, headers: { Authorization: AUTH_HEADER } };
    case "order":
      return {
        method: "POST",
        path: PATHS.orders,
        headers: { ...JSON_HEADERS, "Idempotency-Key": state.idempotencyKey },
        body: orderBody(state.offerJws ?? "", state.mandateJws ?? ""),
      };
  }
}

/** The request body as the terminal shows it: signatures shortened so the line stays readable. */
export function previewBody(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  return JSON.stringify(body, (key, value) => (/jws$/i.test(key) && typeof value === "string" ? `${value.slice(0, 16)}…` : value));
}

export interface StepResult {
  ok: boolean;
  summary: string;
  /** What the next step needs from this response. */
  carry?: Partial<Pick<FlowState, "offerJws" | "mandateJws">>;
}

type Body = Record<string, unknown> | null;

const euros = (amount: unknown) =>
  typeof amount === "number" ? `${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR` : "";

function field<T>(value: unknown, ...path: (string | number)[]): T | undefined {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current as T | undefined;
}

const ORDER_WORDS: Record<string, string> = {
  confirmed: "Confirmed inside the mandate. Valio Aimo signed the receipt.",
  pending_approval: "Over the mandate's limit. Waiting for a person to approve.",
  blocked: "Blocked by a mandate rule. Nothing was ordered.",
  rejected: "Rejected by the approver.",
};

/** Reads one response in plain words and picks out what the next step needs. */
export function readStep(step: FlowStepId, status: number, body: Body): StepResult {
  if (status < 200 || status >= 300 || body === null) {
    return { ok: false, summary: field<string>(body, "detail") ?? `The server answered ${status}.` };
  }
  switch (step) {
    case "search": {
      const hits = field<unknown[]>(body, "hits") ?? [];
      const best = field<string>(hits[0], "product", "name", "en");
      return { ok: hits.length > 0, summary: best ? `${hits.length} products. Best match: ${best}.` : "No products matched." };
    }
    case "quote": {
      const jws = field<string>(body, "primary", "jws");
      const net = euros(field<number>(body, "primary", "offer", "totals", "net", "amount"));
      return { ok: Boolean(jws), summary: jws ? `Signed offer, ${net} net, valid 15 minutes.` : "No offer came back.", carry: { offerJws: jws } };
    }
    case "mandate": {
      const jws = field<string>(body, "jws");
      const name = field<string>(body, "mandate", "agent", "name");
      return { ok: Boolean(jws), summary: jws ? `Signed mandate${name ? ` for ${name}` : ""}.` : "No mandate came back.", carry: { mandateJws: jws } };
    }
    case "order": {
      const state = field<string>(body, "status") ?? "";
      const id = field<string>(body, "id");
      const words = ORDER_WORDS[state] ?? `Order status: ${state}.`;
      return { ok: state === "confirmed" || state === "pending_approval", summary: id ? `${words} ${id}` : words };
    }
  }
}
