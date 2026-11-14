import { field, problemSentence, readOrderAnswer, type AnswerTone, type Body } from "./answers";
import { PATHS, TEST_NEED, authHeader, orderBody, quoteBody, searchBody } from "./requests";

export type FlowStepId = "search" | "quote" | "mandate" | "order";

export interface FlowRequest {
  method: "GET" | "POST";
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface FlowState {
  /** The agent key every call carries: this browser's own once its workspace has answered. */
  key: string;
  deliverBy: string;
  idempotencyKey: string;
  offerJws?: string;
  mandateJws?: string;
}

export const FLOW_STEPS: { id: FlowStepId; label: string }[] = [
  { id: "search", label: "Search the catalogue" },
  { id: "quote", label: "Get a fixed price" },
  { id: "mandate", label: "Read your limits" },
  { id: "order", label: "Place the order" },
];

/** The exact request an outside agent sends for each step of the documented HTTP flow, for the small test order. */
export function flowRequest(step: FlowStepId, state: FlowState): FlowRequest {
  const auth = { Authorization: authHeader(state.key) };
  const json = { ...auth, "Content-Type": "application/json" };
  switch (step) {
    case "search":
      return { method: "POST", path: PATHS.search, headers: json, body: searchBody(state.deliverBy, TEST_NEED) };
    case "quote":
      return { method: "POST", path: PATHS.quotes, headers: json, body: quoteBody(state.deliverBy, TEST_NEED) };
    case "mandate":
      return { method: "GET", path: PATHS.mandate, headers: auth };
    case "order":
      return {
        method: "POST",
        path: PATHS.orders,
        headers: { ...json, "Idempotency-Key": state.idempotencyKey },
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
  /** The flow goes on, or ends well: true for a confirmed order and for one waiting for a person. */
  ok: boolean;
  tone: AnswerTone;
  summary: string;
  /** What the next step needs from this response. */
  carry?: Partial<Pick<FlowState, "offerJws" | "mandateJws">>;
}

const euros = (amount: unknown) =>
  typeof amount === "number" ? `${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR` : "";

const result = (ok: boolean, summary: string, carry?: StepResult["carry"]): StepResult => ({
  ok,
  tone: ok ? "ok" : "error",
  summary,
  ...(carry ? { carry } : {}),
});

/** Reads one response in plain words and picks out what the next step needs. */
export function readStep(step: FlowStepId, status: number, body: Body): StepResult {
  if (step === "order") {
    const answer = readOrderAnswer(status, body);
    return { ok: answer.tone === "ok" || answer.tone === "waiting", ...answer };
  }
  if (status < 200 || status >= 300 || body === null) return result(false, problemSentence(status, body));
  switch (step) {
    case "search": {
      const hits = field<unknown[]>(body, "hits") ?? [];
      const best = field<string>(hits[0], "product", "name", "en");
      return result(hits.length > 0, best ? `${hits.length} products. Best match: ${best}.` : "No products matched.");
    }
    case "quote": {
      const jws = field<string>(body, "primary", "jws");
      const net = euros(field<number>(body, "primary", "offer", "totals", "net", "amount"));
      return result(Boolean(jws), jws ? `Signed offer, ${net} net, valid 15 minutes.` : "No offer came back.", { offerJws: jws });
    }
    case "mandate": {
      const jws = field<string>(body, "jws");
      const name = field<string>(body, "mandate", "agent", "name");
      return result(Boolean(jws), jws ? `Signed mandate${name ? ` for ${name}` : ""}.` : "No mandate came back.", { mandateJws: jws });
    }
  }
}
