import type { AuditEntry, Order, QuoteResponse } from "@/lib/contracts";
import { parseRequest } from "@/lib/agent";
import { now } from "@/lib/clock";
import { gateway } from "@/lib/gateway";
import { ORDER_BLOCKED } from "@/lib/http/order-response";
import type { SignedMandate } from "@/lib/orders/types";
import { AGENT_AUTH, get, ok, post, type Reply } from "./router";

/** Valio Arki Eila lactose-free milk drink 1 l: the cheapest orderable lactose-free milk in the recording. */
export const MILK_ID = "464306";

/** Orders, audit log, activity and mandate back to the defaults. */
export async function resetState(): Promise<void> {
  await gateway().reset();
}

/** Next Monday as the buyer's agent reads "by Monday" today. */
export function monday(): string {
  return parseRequest("by Monday", now()).deliverBy;
}

export async function quoteLitres(
  litres: number,
  options: { productId?: string; intent?: string; headers?: Record<string, string> } = {},
): Promise<QuoteResponse> {
  const body = {
    lines: [{ productId: options.productId ?? MILK_ID, quantity: { amount: litres, unit: "l" } }],
    deliverBy: monday(),
    intent: options.intent ?? `${litres} litres of lactose-free milk by Monday`,
    matchConfidence: "high",
  };
  return ok<QuoteResponse>(await post("/api/v1/quotes", body, options.headers ?? AGENT_AUTH), "Quote");
}

export async function mandate(): Promise<SignedMandate> {
  return ok<SignedMandate>(await get("/api/v1/mandate", AGENT_AUTH), "Mandate");
}

export function placeOrder(offerJws: string, mandateJws: string, key: string, headers: Record<string, string> = AGENT_AUTH): Promise<Reply> {
  return post("/api/v1/orders", { offerJws, mandateJws, idempotencyKey: key }, headers);
}

/** The order an order call answered with: 201 or 202 carry it as the body, 422 order_blocked inside the problem. */
export function orderFrom(reply: Reply): Order | undefined {
  if (reply.status === 201 || reply.status === 202) return reply.body as Order;
  const problem = reply.body as { code?: string; order?: Order } | undefined;
  return reply.status === 422 && problem?.code === ORDER_BLOCKED ? problem.order : undefined;
}

/** The order an order call recorded, whatever its outcome. Throws when the call was refused before an order existed. */
export function recordedOrder(reply: Reply, what: string): Order {
  return orderFrom(reply) ?? ok<Order>(reply, what);
}

/** Quote and order in one step, returning the stored order. */
export async function orderLitres(litres: number, key: string): Promise<Order> {
  const quote = await quoteLitres(litres);
  const { jws } = await mandate();
  return recordedOrder(await placeOrder(quote.primary.jws, jws, key), "Order");
}

/** Signs in through the console session route, as the approver's browser does. */
export async function approverCookie(): Promise<string> {
  const result = await post("/api/v1/console/session", { passcode: process.env.LAITURI_APPROVER_PASSCODE });
  ok(result, "Approver sign-in");
  const cookie = result.headers.get("set-cookie");
  if (!cookie) throw new Error("Approver sign-in set no cookie.");
  return cookie.split(";")[0];
}

/** Signs in the shared workspace's wholesaler operator, as LAITURI_OPERATOR_PASSCODE allows (open on a development server). */
export async function operatorCookie(): Promise<string> {
  const result = await post("/api/v1/console/session", { role: "operator", passcode: process.env.LAITURI_OPERATOR_PASSCODE });
  ok(result, "Operator sign-in");
  const cookie = result.headers.get("set-cookie");
  if (!cookie) throw new Error("Operator sign-in set no cookie.");
  return cookie.split(";")[0];
}

export function auditEntries(): Promise<AuditEntry[]> {
  return gateway().auditLog();
}

export async function auditVerifies(): Promise<boolean> {
  return (await gateway().verifyAudit()).valid;
}

/** Audit events about one order, oldest first, starting with the offer it was placed from. */
export async function orderEvents(order: Order): Promise<string[]> {
  const entries = await auditEntries();
  return entries
    .filter((entry) => {
      if (entry.refs.orderId === order.id) return true;
      if (entry.event !== "offer.issued") return false;
      const alternatives = entry.data.alternativeOfferIds;
      return entry.refs.offerId === order.offer.id || (Array.isArray(alternatives) && alternatives.includes(order.offer.id));
    })
    .map((entry) => entry.event);
}

/** The audit steps an order must leave, by how it ended. */
export function expectedEvents(order: Order): string[] {
  const last = { confirmed: "order.confirmed", pending_approval: "approval.requested", blocked: "order.blocked", rejected: "approval.rejected" }[order.status];
  return ["offer.issued", "order.requested", "policy.evaluated", last];
}

/**
 * Confirmed orders the mandate did not allow: anything not auto-approved with every check passing,
 * and not approved by a person, or with any blocking check.
 */
export async function confirmedOutsideMandate(): Promise<Order[]> {
  const orders = await gateway().listOrders();
  return orders.filter((order) => {
    if (order.status !== "confirmed") return false;
    const blocked = order.decision.checks.some((check) => check.status === "block");
    const auto = order.decision.outcome === "auto_approved" && order.decision.checks.every((check) => check.status === "pass");
    const approved = order.decision.outcome === "needs_approval" && order.approval?.decision === "approved";
    return blocked || !(auto || approved);
  });
}

export function nonPassing(order: Order): string {
  const rules = order.decision.checks.filter((check) => check.status !== "pass").map((check) => `${check.rule}:${check.status}`);
  return rules.length ? rules.join(",") : "all checks pass";
}
