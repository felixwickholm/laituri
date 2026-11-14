import type { Alternative, Order } from "@/lib/contracts";
import { PROBLEM_TYPE_BASE, json, type Problem } from "./respond";

export const ORDER_BLOCKED = "order_blocked";
export const APPROVAL_BLOCKED = "approval_blocked";

/** A blocked order as a problem: the usual fields, plus the order itself so the agent can read which rule stopped it. */
export interface BlockedOrderProblem extends Problem {
  order: Order;
}

/** One plain sentence naming every rule that blocked the order. */
function blockedDetail(order: Order): string {
  const reasons = order.decision.checks
    .filter((check) => check.status === "block")
    .map((check) => check.message.replace(/\.$/, ""));
  return reasons.length ? `The order was blocked: ${reasons.join("; ")}.` : "The order was blocked.";
}

function blockedProblem(order: Order): BlockedOrderProblem {
  return {
    type: PROBLEM_TYPE_BASE + ORDER_BLOCKED,
    title: "Order blocked",
    status: 422,
    detail: blockedDetail(order),
    code: ORDER_BLOCKED,
    order,
  };
}

const SUCCESS_STATUS: Record<Exclude<Order["status"], "blocked">, number> = {
  confirmed: 201,
  pending_approval: 202,
  // Only a replay can find a rejected order: a person decided it after it was placed.
  rejected: 200,
};

/**
 * The answer to placing an order, by outcome: 201 confirmed, 202 waiting for a person, 422 blocked.
 * A replay of the same idempotency key returns the stored order, so it gets the answer its current status gives.
 */
export function orderResponse(order: Order): Response {
  const headers = { location: `/api/v1/orders/${order.id}` };
  if (order.status !== "blocked") return json(order, { status: SUCCESS_STATUS[order.status], headers });
  const response = json(blockedProblem(order), { status: 422, headers });
  response.headers.set("content-type", "application/problem+json");
  return response;
}

/** An approval the re-check stopped: the blocked order, and fresh signed alternatives when its stock was taken. */
export interface BlockedApprovalProblem extends BlockedOrderProblem {
  alternatives: Alternative[];
}

/**
 * The answer to a decision: 200 with the decided order, or 409 when the re-check at approval blocked it, carrying the
 * order and the wholesaler's fresh alternatives so the agent can order one of them instead.
 */
export function approvalResponse(order: Order, alternatives: Alternative[]): Response {
  if (order.status !== "blocked") return json(order);
  const body: BlockedApprovalProblem = {
    ...blockedProblem(order),
    type: PROBLEM_TYPE_BASE + APPROVAL_BLOCKED,
    title: "Approval stopped",
    status: 409,
    code: APPROVAL_BLOCKED,
    detail: blockedDetail(order).replace("The order was blocked", "The approval was stopped"),
    alternatives,
  };
  const response = json(body, { status: 409 });
  response.headers.set("content-type", "application/problem+json");
  return response;
}
