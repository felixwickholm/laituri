import { gateway, type AgentRef } from "@/lib/gateway";
import type { AgentTransport } from "./types";

/** In-process transport: the same gateway calls the REST routes make. */
export function gatewayTransport(agent: AgentRef): AgentTransport {
  return {
    searchCatalog: (request) => gateway().searchCatalog(agent, request),
    getProduct: (id) => gateway().getProduct(agent, id),
    requestQuote: (request) => gateway().requestQuote(agent, request),
    getMandate: () => gateway().getMandate(),
    placeOrder: (request) => gateway().placeOrder(agent, request),
    getOrder: (id) => gateway().getOrder(agent, id),
  };
}
