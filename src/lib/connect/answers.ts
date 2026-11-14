/** A JSON response body, or null when the answer was not JSON. */
export type Body = Record<string, unknown> | null;

/** ok: done; waiting: a person decides next; blocked: a mandate rule or a person stopped it; error: the call failed. */
export type AnswerTone = "ok" | "waiting" | "blocked" | "error";

export interface Answer {
  tone: AnswerTone;
  summary: string;
}

/** Reads a nested field of an untyped JSON value, or undefined when any step along the path is missing. */
export function field<T>(value: unknown, ...path: (string | number)[]): T | undefined {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current as T | undefined;
}

/** Said when a failed answer carries no sentence of its own. */
const STATUS_WORDS: Record<number, string> = {
  0: "The request did not reach the server.",
  401: "The server did not recognise the agent key.",
  403: "This agent may not do that right now.",
  404: "The server did not find what the request names.",
  409: "The request clashes with one already made.",
  422: "The server could not process the request.",
  502: "Valio Aimo did not answer. Try again in a moment.",
};

/** A failed answer in one sentence: the problem's own `detail` when it has one, such as why a quantity was refused. */
export function problemSentence(status: number, body: Body): string {
  const detail = field<string>(body, "detail");
  if (typeof detail === "string" && detail) return detail;
  return STATUS_WORDS[status] ?? `The server answered ${status}.`;
}

/** The sentences of every rule that blocked an order, as the buyer's mandate words them. */
export function blockedReasons(order: unknown): string[] {
  const checks = field<unknown[]>(order, "decision", "checks");
  if (!Array.isArray(checks)) return [];
  return checks
    .filter((check) => field<string>(check, "status") === "block")
    .map((check) => field<string>(check, "message"))
    .filter((message): message is string => typeof message === "string" && message.length > 0)
    .map((message) => (/[.!?]$/.test(message) ? message : `${message}.`));
}

const ORDER_WORDS: Record<string, Answer> = {
  confirmed: { tone: "ok", summary: "Ordered inside your limits. Valio Aimo signed the receipt." },
  pending_approval: { tone: "waiting", summary: "Needs you. A person approves it before it is ordered." },
  rejected: { tone: "blocked", summary: "A person rejected this order. Nothing was ordered." },
};

/**
 * What placing an order answered, in plain words: 201 confirmed, 202 waiting for a person, 422 blocked with the
 * order inside the problem so the blocking rule can be named. Any other failure reads as its problem sentence.
 */
export function readOrderAnswer(status: number, body: Body): Answer {
  const blockedOrder = status === 422 ? field<unknown>(body, "order") : undefined;
  const order = blockedOrder ?? body;
  const state = field<string>(order, "status");
  const id = field<string>(order, "id");
  const withId = (answer: Answer): Answer => (id ? { ...answer, summary: `${answer.summary} Order ${id}.` } : answer);

  if (state === "blocked") {
    const reasons = blockedReasons(order);
    return withId({ tone: "blocked", summary: ["Blocked, nothing was ordered.", ...reasons].join(" ") });
  }
  const known = status >= 200 && status < 300 && state ? ORDER_WORDS[state] : undefined;
  if (known) return withId(known);
  return { tone: "error", summary: problemSentence(status, body) };
}
