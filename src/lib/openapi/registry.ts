import type { SchemaName } from "./schemas";
import { EXAMPLES } from "./examples";

/**
 * agent: a bearer key, or anonymous for catalogue and quotes. reader: records read with an agent key (its own buyer only),
 * a browser's sandbox cookie or a signed-in session; 401 without any. human, operator: a signed-in person. public: anyone.
 */
export type Audience = "agent" | "reader" | "human" | "operator" | "public";
export type Scope = "catalog:read" | "quote:create" | "order:place";

export interface Parameter {
  name: string;
  in: "path" | "query" | "header";
  description: string;
  required?: boolean;
  type: "string" | "integer";
}

/** A further answer the operation gives besides its main success status, such as 202 for an order that waits. */
export interface Outcome {
  status: number;
  description: string;
  response: SchemaName;
  /** Sent as application/problem+json. */
  problem?: true;
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
  outcomes?: Outcome[];
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
const operator = (operation: Omit<Operation, "audience">): Operation => ({ ...operation, audience: "operator", errors: [...operation.errors, 403] });
const reader = (operation: Omit<Operation, "audience">): Operation => ({ ...operation, audience: "reader", errors: [...operation.errors, 401] });

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
    summary: "Read an issued offer", description: "Needs an agent key (its own buyer's offers only), the browser's sandbox or a signed-in session; 401 without any.",
    parameters: [id("id", "Offer id")], response: "SignedOffer", errors: [401, 404] },
  { operationId: "placeOrder", method: "post", path: "/api/v1/orders", tag: "Ordering", audience: "agent", scope: "order:place",
    summary: "Place an order from a signed offer",
    description:
      "Checks the offer and mandate signatures and every mandate rule. Outcomes: 201 confirmed (with a signed receipt), " +
      "202 pending_approval (a human must decide; do not retry with a new key), or 422 order_blocked (nothing ordered; the problem body carries the blocked order and the rules that stopped it). " +
      "A retry with the same idempotency key gets the same answer.",
    parameters: [{ name: "Idempotency-Key", in: "header", type: "string", description: "Used when the body has no idempotencyKey" }],
    body: "PlaceOrderBody", response: "Order", status: 201,
    outcomes: [
      { status: 202, description: "The order waits for the buyer's approver", response: "Order" },
      { status: 422, description: "The mandate blocked the order; nothing was ordered", response: "BlockedOrderProblem", problem: true },
    ],
    errors: [400, 401, 409], example: EXAMPLES.order },
  reader({ operationId: "listOrders", method: "get", path: "/api/v1/orders", tag: "Ordering",
    summary: "List one buyer's orders, newest first", parameters: [buyerQuery], response: "OrderList", errors: [400, 403] }),
  { operationId: "getOrder", method: "get", path: "/api/v1/orders/{id}", tag: "Ordering", audience: "agent", scope: "order:place",
    summary: "Read an order and its status", description: "Needs an agent key (its own buyer's orders only), the browser's sandbox or a signed-in session; 401 without any.",
    parameters: [id("id", "Order id")], response: "Order", errors: [401, 404] },
  reader({ operationId: "listPendingApprovals", method: "get", path: "/api/v1/approvals", tag: "Approvals",
    summary: "One buyer's orders waiting for a human decision", parameters: [buyerQuery], response: "OrderList", errors: [400, 403] }),
  human({ operationId: "decideApproval", method: "post", path: "/api/v1/approvals/{orderId}", tag: "Approvals",
    summary: "Approve or reject a pending order (buyer console only)",
    description: "Refused for any request that carries an agent bearer token. Requires a signed approver session, which only the console sign-in issues. Another buyer's order is not found.",
    parameters: [id("orderId", "Order id")], body: "ApprovalDecisionRequest", response: "Order", errors: [400, 404, 409] }),
  reader({ operationId: "getMandate", method: "get", path: "/api/v1/mandate", tag: "Mandate",
    summary: "Read a buyer-signed mandate", description: "With an agent token, the mandate of that token's buyer.",
    parameters: [buyerQuery], response: "SignedMandate", errors: [400, 403] }),
  human({ operationId: "updateMandate", method: "put", path: "/api/v1/mandate", tag: "Mandate",
    summary: "Change the signed-in approver's buyer's mandate (buyer console only)", body: "MandatePatch", response: "SignedMandate", errors: [400] }),
  reader({ operationId: "getAuditLog", method: "get", path: "/api/v1/audit", tag: "Audit",
    summary: "Read the hash-chained audit log",
    description:
      "A browser in its sandbox or a signed-in person reads every entry. An agent key reads its own buyer's entries in full and every other entry " +
      "as a stub (seq, at, event, prevHash, contentDigest, hash, signature, redacted: true), which is enough to verify the whole chain with the JWKS.",
    parameters: [{ name: "after", in: "query", type: "integer", description: "Only entries with a higher seq" }],
    response: "AuditLog", errors: [400] }),
  { operationId: "verifyAudit", method: "get", path: "/api/v1/audit/verify", tag: "Audit", audience: "public",
    summary: "Verify the chain and every signature", response: "AuditVerification", errors: [] },
  { operationId: "getAuditCheckpoint", method: "get", path: "/api/v1/audit/checkpoint", tag: "Audit", audience: "public",
    summary: "Signed statement of log size and head hash", response: "Checkpoint", errors: [] },
  reader({ operationId: "listActivity", method: "get", path: "/api/v1/activity", tag: "Audit",
    summary: "Recent calls by one buyer's agents and by callers without a token",
    parameters: [{ name: "after", in: "query", type: "string", description: "Only activity after this id" }, buyerQuery],
    response: "ActivityList", errors: [400, 403] }),
  operator({ operationId: "getSupplierOverview", method: "get", path: "/api/v1/supplier/overview", tag: "Supplier",
    summary: "The wholesaler's view of agent trade across every buyer",
    description:
      "Connected agents, demand, unmet demand with the estimated lost value, offers, orders by outcome, the mandate rules that fired and a 7-day series. " +
      "Holds only what reached the wholesaler. Needs a signed-in session or the browser's sandbox (401 without either); refused for agent credentials.",
    response: "SupplierOverview", errors: [401] }),
  operator({ operationId: "setAgentSuspension", method: "post", path: "/api/v1/supplier/agents/{agentId}/suspension", tag: "Supplier",
    summary: "Suspend or resume one agent (wholesaler operator only)",
    description:
      "While an agent is suspended, every call it makes over REST or MCP is refused with 403 and the problem code agent_suspended. " +
      "Needs a wholesaler operator session (POST /api/v1/console/session with role operator: demo access in a sandbox, LAITURI_OPERATOR_PASSCODE in the shared workspace). " +
      "No session, a buyer approver's session or any agent credential is refused with 403 and a signed audit entry. " +
      "The suspension, the resumption and every refused call are signed audit entries that name the operator and say when demo access was used. Asking for the state the agent is already in changes nothing.",
    parameters: [id("agentId", "Agent id as the supplier overview lists it, for example agent:kaisla-menu-planner")],
    body: "SuspensionRequest", response: "SuspensionState", errors: [400, 404] }),
  human({ operationId: "resetDemo", method: "post", path: "/api/v1/demo/reset", tag: "System",
    summary: "Start the caller's workspace over (console only)",
    description:
      "In a visitor's sandbox: a fresh copy of the seeded week, for that sandbox only, at the browser's word. " +
      "In the shared workspace: needs the approver; clears orders, audit and activity, then writes the demo history again when LAITURI_SEED is on.",
    response: "ResetResult", errors: [] }),
  { operationId: "getWorkspace", method: "get", path: "/api/v1/workspace", tag: "System", audience: "public",
    summary: "The browser's workspace and its agent keys (console only)",
    description:
      "Each browser gets its own sandbox, an in-memory copy of the demo, named by an HttpOnly cookie. Its agent keys work as bearer tokens or as ?key= on /mcp, " +
      "and calls with them land in that sandbox. A caller without a cookie sees the shared workspace and its fixed demo tokens. Refused for agent credentials.",
    response: "WorkspaceInfo", errors: [403] },
  { operationId: "createWorkspace", method: "post", path: "/api/v1/workspace", tag: "System", audience: "public",
    summary: "Create a private sandbox for a client without a browser",
    description:
      "No credential needed. Answers 201 with the new sandbox's agent keys, one per demo buyer, and their MCP addresses; no cookie is set, so the keys are the only way in. " +
      "An unused sandbox is dropped after the idle limit. Each client address may create a few per ten minutes (429 too_many_sandboxes with Retry-After). Refused for agent credentials.",
    response: "WorkspaceInfo", status: 201, errors: [403, 429] },
  { operationId: "setWorkspaceView", method: "post", path: "/api/v1/workspace/view", tag: "System", audience: "public",
    summary: "Look at the shared workspace, or back at your sandbox (console only)",
    description: "The shared workspace is read-only for a browser unless it signs in with the passcode. The sandbox is kept meanwhile. Refused for agent credentials.",
    body: "WorkspaceViewRequest", response: "WorkspaceInfo", errors: [400, 403] },
  { operationId: "getHealth", method: "get", path: "/api/v1/health", tag: "System", audience: "public",
    summary: "Service and upstream status", description: "Includes whether demo history was written at start-up, which engine runs free-text requests, and how many sandboxes are active.",
    response: "Health", errors: [] },
  { operationId: "getVoice", method: "get", path: "/api/v1/voice", tag: "System", audience: "public",
    summary: "Which voice the console speaks with (console only)", description: "Refused for agent credentials.",
    response: "VoiceSettings", errors: [403] },
  { operationId: "speakText", method: "post", path: "/api/v1/voice/speech", tag: "System", audience: "public",
    summary: "Read a short text aloud as MP3 (console only)",
    description: "Uses ElevenLabs; the key stays on the server. Answers 404 voice_not_configured when the server has no ElevenLabs key. Refused for agent credentials.",
    body: "SpeechRequest", response: "SpeechAudio", responseType: "audio/mpeg", errors: [400, 403, 404, 502] },
];
