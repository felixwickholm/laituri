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
  SuspensionRequest,
  SuspensionState,
} from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import type { OfferDeps } from "@/lib/offers/types";
import type { SupplierOverview } from "@/lib/insights/types";
import type { Decider, MandatePatch, OrderDeps, SignedMandate } from "@/lib/orders/types";
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
  /** The buyer whose token the agent holds. Without one the agent acts in the primary buyer's context. */
  buyer?: { id: string; name: string };
  /** The client application that made the call, for example "Claude Code". */
  client?: string;
}

/** The wholesaler's person who suspends or resumes an agent, as the audit entry names them. */
export interface Operator {
  id: string;
  name: string;
  /** How they signed in, when the audit entry must say so, for example "demo access". */
  via?: string;
}

/** Input as it arrives from REST or MCP; the gateway validates it. */
export type SearchInput = Omit<SearchRequest, "limit"> & { limit?: number };

export interface Gateway {
  searchCatalog(agent: AgentRef, request: SearchInput): Promise<SearchResponse>;
  getProduct(agent: AgentRef, id: string): Promise<Product>;
  requestQuote(agent: AgentRef, request: QuoteRequest): Promise<QuoteResponse>;
  placeOrder(agent: AgentRef, request: PlaceOrderRequest): Promise<Order>;
  getOrder(agent: AgentRef, id: string): Promise<Order>;
  /** Methods that take a buyer id or a decider mean the primary buyer when given none. */
  listOrders(buyerId?: string): Promise<Order[]>;
  pendingApprovals(buyerId?: string): Promise<Order[]>;
  decideApproval(orderId: string, body: ApprovalDecisionRequest, decider?: Decider): Promise<Order>;
  getMandate(buyerId?: string): Promise<SignedMandate>;
  updateMandate(patch: MandatePatch, decider?: Decider): Promise<SignedMandate>;
  auditLog(afterSeq?: number): Promise<AuditEntry[]>;
  verifyAudit(): Promise<AuditVerification>;
  /** One buyer's agents' activity, plus calls from callers without a token. */
  activity(afterId?: string, buyerId?: string): Promise<Activity[]>;
  /** The wholesaler's view across every buyer: what reached it, never a buyer's mandate terms. */
  supplierOverview(): Promise<SupplierOverview>;
  /** Refuses, and logs, a call by an agent the wholesaler has suspended. `call` names the call, for example "POST /api/v1/quotes". */
  admitAgent(agent: AgentRef, call: string): Promise<void>;
  /** A signed-in wholesaler operator suspends or resumes an agent that has reached the wholesaler. */
  setAgentSuspension(agentId: string, request: SuspensionRequest, operator: Operator): Promise<SuspensionState>;
  reset(): Promise<void>;
}
