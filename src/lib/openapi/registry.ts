import type { SchemaName } from "./schemas";
import { EXAMPLES } from "./examples";

export type Audience = "agent" | "human" | "public";
export type Scope = "catalog:read" | "quote:create" | "order:place";

export interface Parameter {
  name: string;
  in: "path" | "query" | "header";
  description: string;
  required?: boolean;
  type: "string" | "integer";
}

export interface Operation {
  operationId: string;
  method: "get" | "post" | "put";
  path: string;
  summary: string;
  description?: string;
  tag: "Catalogue" | "Ordering" | "Approvals" | "Mandate" | "Audit" | "Supplier" | "System";
  audience: Audience;
  scope?: Scope;
  parameters?: Parameter[];
  body?: SchemaName;
  response: SchemaName;
  /** Media type of the success response; JSON when not given. */
  responseType?: "audio/mpeg";
  status?: number;
  errors: number[];
  example?: { request?: unknown; response?: unknown };
}

const id = (name: string, description: string): Parameter => ({ name, in: "path", description, required: true, type: "string" });
const buyerQuery: Parameter = {
  name: "buyer",
  in: "query",
  type: "string",
  description: "Buyer id. Defaults to the signed-in approver's buyer, else the primary buyer. An agent token reads only its own buyer.",
};
const human = (operation: Omit<Operation, "audience">): Operation => ({ ...operation, audience: "human", errors: [...operation.errors, 403] });

/** Every HTTP operation. The OpenAPI document and the MCP tools are both built from this list. */
export const OPERATIONS: Operation[] = [
  { operationId: "searchCatalog", method: "post", path: "/api/v1/products/search", tag: "Catalogue", audience: "agent", scope: "catalog:read",
    summary: "Find products for a need in plain language",
    description:
      "Returns ranked products with net content per sales unit, claims, allergens and an interpretation with a match confidence. " +
      "Every hit carries facts the wholesaler vouches for: country of origin, labels, delivery reliability and the category-average CO2 per kg. " +
      "With a clear match, prefer (price, reliability or sustainability) sets the ranking; price is the default.",
    body: "SearchRequest", response: "SearchResponse", errors: [400, 401], example: EXAMPLES.search },
  { operationId: "getProduct", method: "get", path: "/api/v1/products/{id}", tag: "Catalogue", audience: "agent", scope: "catalog:read",
    summary: "Read one product", parameters: [id("id", "Wholesaler product code, for example 464306")],
    response: "Product", errors: [401, 404] },
  { operationId: "requestQuote", method: "post", path: "/api/v1/quotes", tag: "Ordering", audience: "agent", scope: "quote:create",
    summary: "Get a signed fixed-price offer",
    description:
      "Prices the request with live price and availability. Returns a wholesaler-signed offer valid for 15 minutes and signed alternatives when the request cannot be met in full and on time. " +
      "Each offer line carries the signed product facts (origin, labels, delivery reliability, category-average CO2). Each alternative has a tier (good, better, best) and the one-sentence meaning of that tier.",
    body: "QuoteRequest", response: "QuoteResponse", errors: [400, 401, 404, 502], example: EXAMPLES.quote },
  { operationId: "getOffer", method: "get", path: "/api/v1/offers/{id}", tag: "Ordering", audience: "agent", scope: "quote:create",
    summary: "Read an issued offer", parameters: [id("id", "Offer id")], response: "SignedOffer", errors: [401, 404] },
  { operationId: "placeOrder", method: "post", path: "/api/v1/orders", tag: "Ordering", audience: "agent", scope: "order:place",
    summary: "Place an order from a signed offer",
    description: "Checks the offer and mandate signatures and every mandate rule. Outcomes: confirmed (with a signed receipt), pending_approval (a human must decide; do not retry with a new key), or blocked (nothing ordered).",
    parameters: [{ name: "Idempotency-Key", in: "header", type: "string", description: "Used when the body has no idempotencyKey" }],
    body: "PlaceOrderBody", response: "Order", status: 201, errors: [400, 401, 409], example: EXAMPLES.order },
  { operationId: "listOrders", method: "get", path: "/api/v1/orders", tag: "Ordering", audience: "public",
    summary: "List one buyer's orders, newest first", parameters: [buyerQuery], response: "OrderList", errors: [400, 403] },
  { operationId: "getOrder", method: "get", path: "/api/v1/orders/{id}", tag: "Ordering", audience: "agent", scope: "order:place",
    summary: "Read an order and its status", parameters: [id("id", "Order id")], response: "Order", errors: [401, 404] },
  { operationId: "listPendingApprovals", method: "get", path: "/api/v1/approvals", tag: "Approvals", audience: "public",
    summary: "One buyer's orders waiting for a human decision", parameters: [buyerQuery], response: "OrderList", errors: [400, 403] },
  human({ operationId: "decideApproval", method: "post", path: "/api/v1/approvals/{orderId}", tag: "Approvals",
    summary: "Approve or reject a pending order (buyer console only)",
    description: "Refused for any request that carries an agent bearer token. Requires a signed approver session, which only the console sign-in issues. Another buyer's order is not found.",
    parameters: [id("orderId", "Order id")], body: "ApprovalDecisionRequest", response: "Order", errors: [400, 404, 409] }),
  { operationId: "getMandate", method: "get", path: "/api/v1/mandate", tag: "Mandate", audience: "public",
    summary: "Read a buyer-signed mandate", description: "With an agent token, the mandate of that token's buyer.",
    parameters: [buyerQuery], response: "SignedMandate", errors: [400, 403] },
  human({ operationId: "updateMandate", method: "put", path: "/api/v1/mandate", tag: "Mandate",
    summary: "Change the signed-in approver's buyer's mandate (buyer console only)", body: "MandatePatch", response: "SignedMandate", errors: [400] }),
  { operationId: "getAuditLog", method: "get", path: "/api/v1/audit", tag: "Audit", audience: "public",
    summary: "Read the hash-chained audit log",
    parameters: [{ name: "after", in: "query", type: "integer", description: "Only entries with a higher seq" }],
    response: "AuditLog", errors: [400] },
  { operationId: "verifyAudit", method: "get", path: "/api/v1/audit/verify", tag: "Audit", audience: "public",
    summary: "Verify the chain and every signature", response: "AuditVerification", errors: [] },
  { operationId: "getAuditCheckpoint", method: "get", path: "/api/v1/audit/checkpoint", tag: "Audit", audience: "public",
    summary: "Signed statement of log size and head hash", response: "Checkpoint", errors: [] },
  { operationId: "listActivity", method: "get", path: "/api/v1/activity", tag: "Audit", audience: "public",
    summary: "Recent calls by one buyer's agents and by callers without a token",
    parameters: [{ name: "after", in: "query", type: "string", description: "Only activity after this id" }, buyerQuery],
    response: "ActivityList", errors: [400, 403] },
  { operationId: "getSupplierOverview", method: "get", path: "/api/v1/supplier/overview", tag: "Supplier", audience: "public",
    summary: "The wholesaler's view of agent trade across every buyer",
    description: "Connected agents, demand, unmet demand with the estimated lost value, offers, orders by outcome, the mandate rules that fired and a 7-day series. Holds only what reached the wholesaler. Refused for agent credentials.",
    response: "SupplierOverview", errors: [403] },
  { operationId: "setAgentSuspension", method: "post", path: "/api/v1/supplier/agents/{agentId}/suspension", tag: "Supplier", audience: "public",
    summary: "Suspend or resume one agent (wholesaler control)",
    description:
      "While an agent is suspended, every call it makes over REST or MCP is refused with 403 and the problem code agent_suspended. " +
      "The suspension, the resumption and every refused call are audit entries signed by the wholesaler. Asking for the state the agent is already in changes nothing. " +
      "In the demo this control is open to console visitors and refuses agent credentials, like the other demo controls; production puts it behind the wholesaler's own sign-in.",
    parameters: [id("agentId", "Agent id as the supplier overview lists it, for example agent:kaisla-menu-planner")],
    body: "SuspensionRequest", response: "SuspensionState", errors: [400, 403, 404] },
  human({ operationId: "resetDemo", method: "post", path: "/api/v1/demo/reset", tag: "System",
    summary: "Clear orders, audit and activity, then write the demo history again when LAITURI_SEED is on (buyer console only)",
    response: "ResetResult", errors: [] }),
  { operationId: "getHealth", method: "get", path: "/api/v1/health", tag: "System", audience: "public",
    summary: "Service and upstream status", description: "Includes whether demo history was written at start-up and which engine runs free-text requests.",
    response: "Health", errors: [] },
  { operationId: "getVoice", method: "get", path: "/api/v1/voice", tag: "System", audience: "public",
    summary: "Which voice the console speaks with (console only)", description: "Refused for agent credentials.",
    response: "VoiceSettings", errors: [403] },
  { operationId: "speakText", method: "post", path: "/api/v1/voice/speech", tag: "System", audience: "public",
    summary: "Read a short text aloud as MP3 (console only)",
    description: "Uses ElevenLabs; the key stays on the server. Answers 404 voice_not_configured when the server has no ElevenLabs key. Refused for agent credentials.",
    body: "SpeechRequest", response: "SpeechAudio", responseType: "audio/mpeg", errors: [400, 403, 404, 502] },
];
