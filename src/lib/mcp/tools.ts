import { z } from "zod";
import { PlaceOrderRequest, QuoteRequest, SearchRequest } from "@/lib/contracts";
import { checkpoint } from "@/lib/audit";
import { gateway, type AgentRef } from "@/lib/gateway";
import type { SchemaName } from "@/lib/openapi/schemas";
import { auditText, mandateText, orderText, productText, quoteText, searchText } from "./summaries";

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  /** REST operation this tool mirrors, for cross-reference in discovery documents. */
  operationId: string;
  input: z.ZodType;
  output: SchemaName;
  run(agent: AgentRef, input: never): Promise<unknown>;
  summarize(result: never): string;
}

const define = <I extends z.ZodType, O>(tool: {
  name: string;
  title: string;
  description: string;
  operationId: string;
  input: I;
  output: SchemaName;
  run(agent: AgentRef, input: z.infer<I>): Promise<O>;
  summarize(result: O): string;
}): ToolDefinition => tool as unknown as ToolDefinition;

const NoInput = z.object({});

export const TOOLS: ToolDefinition[] = [
  define({
    name: "search_catalog",
    title: "Search the wholesaler catalogue",
    description:
      "Use first to turn a buyer's need (Finnish, Swedish or English) into product codes. " +
      "Returns ranked products with net content per sales unit and lot size (for pack maths), claims and allergens, " +
      "and an interpretation with a confidence. If confidence is low or a note is set, ask the human to clarify. " +
      "Next: request_quote with the chosen productId.",
    operationId: "searchCatalog",
    input: SearchRequest,
    output: "SearchResponse",
    run: (agent, input) => gateway().searchCatalog(agent, input),
    summarize: searchText,
  }),
  define({
    name: "get_product",
    title: "Read one product",
    description: "Use to check one product's full record: units, content, claims, allergens, origin and substitutes.",
    operationId: "getProduct",
    input: z.object({ productId: z.string().min(1).describe("Wholesaler product code, for example 464306") }),
    output: "Product",
    run: (agent, input) => gateway().getProduct(agent, input.productId),
    summarize: productText,
  }),
  define({
    name: "request_quote",
    title: "Get a signed fixed-price offer",
    description:
      "Use after search to price a need for a delivery date. Give quantities in l or kg and the wholesaler converts to whole sales units. " +
      "Returns a wholesaler-signed offer (valid 15 minutes) with live price and availability, plus signed alternatives " +
      "when the request cannot be met in full and on time. Pass the chosen offer's jws unchanged to place_order. " +
      "Pass matchConfidence from the search interpretation.",
    operationId: "requestQuote",
    input: QuoteRequest,
    output: "QuoteResponse",
    run: (agent, input) => gateway().requestQuote(agent, input),
    summarize: quoteText,
  }),
  define({
    name: "get_mandate",
    title: "Read your purchasing mandate",
    description:
      "Use before ordering to learn your authority: spend limits, allowed categories, dietary rules, substitution and delivery rules. " +
      "Returns the buyer-signed mandate JWS (pass it as mandateJws to place_order) and the readable limits.",
    operationId: "getMandate",
    input: NoInput,
    output: "SignedMandate",
    run: () => gateway().getMandate(),
    summarize: mandateText,
  }),
  define({
    name: "place_order",
    title: "Place an order from a signed offer",
    description:
      "Use to commit to an offer. Needs offerJws (unchanged from request_quote), mandateJws (from get_mandate) and an idempotencyKey you choose. " +
      "Three outcomes: confirmed (signed receipt in receiptJws), pending_approval (the order exceeds your mandate; " +
      "stop and tell the human, do not retry with another key), or blocked (a hard rule failed; nothing was ordered, the checks say why). " +
      "Retrying with the same key is safe. Orders are simulated.",
    operationId: "placeOrder",
    input: PlaceOrderRequest,
    output: "Order",
    run: (agent, input) => gateway().placeOrder(agent, input),
    summarize: orderText,
  }),
  define({
    name: "get_order",
    title: "Check an order's status",
    description: "Use to poll an order, for example after pending_approval. Returns the order with its status, policy checks and any receipt.",
    operationId: "getOrder",
    input: z.object({ orderId: z.string().min(1) }),
    output: "Order",
    run: (agent, input) => gateway().getOrder(agent, input.orderId),
    summarize: orderText,
  }),
  define({
    name: "verify_audit",
    title: "Verify the audit trail",
    description:
      "Use to prove what happened. Verifies the hash chain and every wholesaler signature in the audit log, " +
      "and returns a signed checkpoint (size and head hash) you can keep and compare later. Public keys: /.well-known/jwks.json.",
    operationId: "verifyAudit",
    input: NoInput,
    output: "AuditProof",
    run: async () => ({ verification: await gateway().verifyAudit(), checkpoint: await checkpoint() }),
    summarize: auditText,
  }),
];

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
