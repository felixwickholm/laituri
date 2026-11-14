import { gateway, type AgentRef, type Gateway } from "@/lib/gateway";
import type { AgentTransport } from "./types";

/** In-process transport: the same gateway calls the REST routes make. The seed passes its own backdated gateway. */
export function gatewayTransport(agent: AgentRef, front: () => Gateway = gateway): AgentTransport {
  return {
    searchCatalog: (request) => front().searchCatalog(agent, request),
    getProduct: (id) => front().getProduct(agent, id),
    requestQuote: (request) => front().requestQuote(agent, request),
    getMandate: () => front().getMandate(agent.buyer?.id),
    placeOrder: (request) => front().placeOrder(agent, request),
    getOrder: (id) => front().getOrder(agent, id),
  };
}
