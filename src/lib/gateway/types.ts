import type {
  ApprovalDecisionRequest,
  AuditEntry,
  AuditVerification,
  Order,
  PlaceOrderRequest,
  Product,
  QuoteRequest,
  QuoteResponse,
  SearchRequest,
  SearchResponse,
} from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import type { OfferDeps } from "@/lib/offers/types";
import type { MandatePatch, OrderDeps, SignedMandate } from "@/lib/orders/types";
import type { Activity, Store } from "@/lib/store/types";

/** Everything the engines need. Only deps.ts binds the real modules; tests pass fakes. */
export interface Deps extends OfferDeps, OrderDeps {
  catalog: Catalog;
  trust: OrderDeps["trust"];
  store: Store;
}

/** The caller of an agent-facing method. */
export interface AgentRef {
  id: string;
  name: string;
}

/** Input as it arrives from REST or MCP; the gateway validates it. */
export type SearchInput = Omit<SearchRequest, "limit"> & { limit?: number };

export interface Gateway {
  searchCatalog(agent: AgentRef, request: SearchInput): Promise<SearchResponse>;
  getProduct(agent: AgentRef, id: string): Promise<Product>;
  requestQuote(agent: AgentRef, request: QuoteRequest): Promise<QuoteResponse>;
  placeOrder(agent: AgentRef, request: PlaceOrderRequest): Promise<Order>;
  getOrder(agent: AgentRef, id: string): Promise<Order>;
  listOrders(): Promise<Order[]>;
  pendingApprovals(): Promise<Order[]>;
  decideApproval(orderId: string, body: ApprovalDecisionRequest): Promise<Order>;
  getMandate(): Promise<SignedMandate>;
  updateMandate(patch: MandatePatch): Promise<SignedMandate>;
  auditLog(afterSeq?: number): Promise<AuditEntry[]>;
  verifyAudit(): Promise<AuditVerification>;
  activity(afterId?: string): Promise<Activity[]>;
  reset(): Promise<void>;
}
