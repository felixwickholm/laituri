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
  tag: "Catalogue" | "Ordering" | "Approvals" | "Mandate" | "Audit" | "System";
  audience: Audience;
  scope?: Scope;
  parameters?: Parameter[];
  body?: SchemaName;
  response: SchemaName;
  status?: number;
  errors: number[];
  example?: { request?: unknown; response?: unknown };
}

const id = (name: string, description: string): Parameter => ({ name, in: "path", description, required: true, type: "string" });
const human = (operation: Omit<Operation, "audience">): Operation => ({ ...operation, audience: "human", errors: [...operation.errors, 403] });

/** Every HTTP operation. The OpenAPI document and the MCP tools are both built from this list. */
export const OPERATIONS: Operation[] = [
  { operationId: "searchCatalog", method: "post", path: "/api/v1/products/search", tag: "Catalogue", audience: "agent", scope: "catalog:read",
    summary: "Find products for a need in plain language",
    description: "Returns ranked products with net content per sales unit, claims, allergens and an interpretation with a match confidence.",
    body: "SearchRequest", response: "SearchResponse", errors: [400, 401], example: EXAMPLES.search },
  { operationId: "getProduct", method: "get", path: "/api/v1/products/{id}", tag: "Catalogue", audience: "agent", scope: "catalog:read",
    summary: "Read one product", parameters: [id("id", "Wholesaler product code, for example 464306")],
    response: "Product", errors: [401, 404] },
  { operationId: "requestQuote", method: "post", path: "/api/v1/quotes", tag: "Ordering", audience: "agent", scope: "quote:create",
    summary: "Get a signed fixed-price offer",
    description: "Prices the request with live price and availability. Returns a wholesaler-signed offer valid for 15 minutes and signed alternatives when the request cannot be met in full and on time.",
    body: "QuoteRequest", response: "QuoteResponse", errors: [400, 401, 404, 502], example: EXAMPLES.quote },
  { operationId: "getOffer", method: "get", path: "/api/v1/offers/{id}", tag: "Ordering", audience: "agent", scope: "quote:create",
    summary: "Read an issued offer", parameters: [id("id", "Offer id")], response: "SignedOffer", errors: [401, 404] },
  { operationId: "placeOrder", method: "post", path: "/api/v1/orders", tag: "Ordering", audience: "agent", scope: "order:place",
    summary: "Place an order from a signed offer",
    description: "Checks the offer and mandate signatures and every mandate rule. Outcomes: confirmed (with a signed receipt), pending_approval (a human must decide; do not retry with a new key), or blocked (nothing ordered).",
    parameters: [{ name: "Idempotency-Key", in: "header", type: "string", description: "Used when the body has no idempotencyKey" }],
    body: "PlaceOrderBody", response: "Order", status: 201, errors: [400, 401, 409], example: EXAMPLES.order },
  { operationId: "listOrders", method: "get", path: "/api/v1/orders", tag: "Ordering", audience: "public",
    summary: "List orders, newest first", response: "OrderList", errors: [] },
  { operationId: "getOrder", method: "get", path: "/api/v1/orders/{id}", tag: "Ordering", audience: "agent", scope: "order:place",
    summary: "Read an order and its status", parameters: [id("id", "Order id")], response: "Order", errors: [401, 404] },
  { operationId: "listPendingApprovals", method: "get", path: "/api/v1/approvals", tag: "Approvals", audience: "public",
    summary: "Orders waiting for a human decision", response: "OrderList", errors: [] },
  human({ operationId: "decideApproval", method: "post", path: "/api/v1/approvals/{orderId}", tag: "Approvals",
    summary: "Approve or reject a pending order (buyer console only)",
    description: "Refused for any request that carries an agent bearer token. Requires a signed approver session, which only the console sign-in issues.",
    parameters: [id("orderId", "Order id")], body: "ApprovalDecisionRequest", response: "Order", errors: [400, 404, 409] }),
  { operationId: "getMandate", method: "get", path: "/api/v1/mandate", tag: "Mandate", audience: "public",
    summary: "Read the buyer-signed mandate", response: "SignedMandate", errors: [] },
  human({ operationId: "updateMandate", method: "put", path: "/api/v1/mandate", tag: "Mandate",
    summary: "Change the mandate (buyer console only)", body: "MandatePatch", response: "SignedMandate", errors: [400] }),
  { operationId: "getAuditLog", method: "get", path: "/api/v1/audit", tag: "Audit", audience: "public",
    summary: "Read the hash-chained audit log",
    parameters: [{ name: "after", in: "query", type: "integer", description: "Only entries with a higher seq" }],
    response: "AuditLog", errors: [400] },
  { operationId: "verifyAudit", method: "get", path: "/api/v1/audit/verify", tag: "Audit", audience: "public",
    summary: "Verify the chain and every signature", response: "AuditVerification", errors: [] },
  { operationId: "getAuditCheckpoint", method: "get", path: "/api/v1/audit/checkpoint", tag: "Audit", audience: "public",
    summary: "Signed statement of log size and head hash", response: "Checkpoint", errors: [] },
  { operationId: "listActivity", method: "get", path: "/api/v1/activity", tag: "Audit", audience: "public",
    summary: "Recent agent calls through the front door",
    parameters: [{ name: "after", in: "query", type: "string", description: "Only activity after this id" }],
    response: "ActivityList", errors: [] },
  human({ operationId: "resetDemo", method: "post", path: "/api/v1/demo/reset", tag: "System",
    summary: "Clear orders, audit and activity (buyer console only)", response: "ResetResult", errors: [] }),
  { operationId: "getHealth", method: "get", path: "/api/v1/health", tag: "System", audience: "public",
    summary: "Service and upstream status", response: "Health", errors: [] },
];
