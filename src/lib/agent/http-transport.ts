import type { Order } from "@/lib/contracts";
import { ORDER_BLOCKED } from "@/lib/http/order-response";
import type { AgentTransport } from "./types";

/** A problem response from the REST interface. */
export class TransportError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "TransportError";
  }
}

/** A blocked order answers 422 and carries the order, which the agent reads like any other outcome. */
function blockedOrder(problem: unknown): Order | undefined {
  const body = problem as { code?: string; order?: Order } | undefined;
  return body?.code === ORDER_BLOCKED ? body.order : undefined;
}

/** REST transport: what an outside agent uses, with a bearer token. */
export function httpTransport(baseUrl: string, token: string): AgentTransport {
  const root = baseUrl.replace(/\/+$/, "");

  async function call<T>(method: "GET" | "POST", path: string, body?: unknown, readProblem?: (problem: unknown) => T | undefined): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      const answer = readProblem?.(parsed);
      if (answer !== undefined) return answer;
      const problem = (parsed ?? {}) as { detail?: string; code?: string };
      throw new TransportError(problem.detail ?? `The request failed with status ${response.status}.`, response.status, problem.code);
    }
    return parsed as T;
  }

  return {
    searchCatalog: (request) => call("POST", "/api/v1/products/search", request),
    getProduct: (id) => call("GET", `/api/v1/products/${encodeURIComponent(id)}`),
    requestQuote: (request) => call("POST", "/api/v1/quotes", request),
    getMandate: () => call("GET", "/api/v1/mandate"),
    placeOrder: (request) => call("POST", "/api/v1/orders", request, blockedOrder),
    getOrder: (id) => call("GET", `/api/v1/orders/${encodeURIComponent(id)}`),
  };
}
