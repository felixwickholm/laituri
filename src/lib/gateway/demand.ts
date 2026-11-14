import type { QuoteRequest, QuoteResponse, SearchRequest, SearchResponse } from "@/lib/contracts";
import { assessQuote, assessSearch, logDemand } from "@/lib/demand";
import { UNKNOWN_CLIENT } from "@/lib/http/client-app";
import type { AgentRef, Deps } from "./types";

type LogDeps = Pick<Deps, "store" | "now" | "catalog">;

function caller(agent: AgentRef) {
  return {
    agent: { id: agent.id, name: agent.name },
    ...(agent.buyer ? { buyer: { id: agent.buyer.id, name: agent.buyer.name } } : {}),
    client: agent.client ?? UNKNOWN_CLIENT,
  };
}

/** Logs a catalogue search as the start of a request. */
export async function recordSearch(agent: AgentRef, request: SearchRequest, response: SearchResponse, deps: LogDeps): Promise<void> {
  await logDemand(
    {
      kind: "search",
      ...caller(agent),
      words: request.query,
      concept: response.interpretation.concept,
      productIds: response.hits.map((hit) => hit.product.id),
      quantity: request.need,
      deliverBy: request.deliverBy,
      ...assessSearch(response),
    },
    deps,
  );
}

/** Logs a quote; it continues the caller's latest request when that found the product or was for the same product type. */
export async function recordQuote(agent: AgentRef, request: QuoteRequest, response: QuoteResponse, deps: LogDeps): Promise<void> {
  const [first] = request.lines;
  await logDemand(
    {
      kind: "quote",
      ...caller(agent),
      words: request.intent,
      concept: deps.catalog.get(first.productId)?.concept,
      productIds: request.lines.map((line) => line.productId),
      quantity: first.quantity,
      deliverBy: request.deliverBy,
      offerId: response.primary.offer.id,
      ...assessQuote(response),
    },
    deps,
  );
}
