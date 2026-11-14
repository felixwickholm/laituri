import type { Approval, ApprovalDecisionRequest, Order } from "@/lib/contracts";
import { NotFoundError, StateError } from "@/lib/gateway/errors";
import { confirmOrder } from "./confirm";
import { serial } from "./lock";
import { SUPPLIER_ACTOR, orderRefs, summaries } from "./summaries";
import type { Decider, OrderDeps, StoredOrder } from "./types";

async function save(previous: Order, next: Order, deps: OrderDeps): Promise<Order> {
  const stored: StoredOrder = { ...next, idempotencyKey: (previous as StoredOrder).idempotencyKey };
  await deps.store.orders.put(stored);
  return next;
}

/**
 * The approver of the order's buyer decides a pending order. The decision is signed with the approver key.
 * Another buyer's approver cannot see the order. An offer that expired while waiting cannot be confirmed,
 * so the order is rejected and the reason audited.
 */
export function decideApproval(orderId: string, body: ApprovalDecisionRequest, deps: OrderDeps, decider: Decider): Promise<Order> {
  return serial(() => decide(orderId, body, deps, decider));
}

async function decide(orderId: string, body: ApprovalDecisionRequest, deps: OrderDeps, decider: Decider): Promise<Order> {
  const order = await deps.store.orders.get(orderId);
  if (!order || order.buyer.id !== decider.buyerId) throw new NotFoundError(`Order ${orderId} was not found.`);
  if (order.status !== "pending_approval") {
    throw new StateError(`Order ${orderId} is ${order.status.replace("_", " ")} and does not wait for approval.`);
  }
  const now = deps.now();
  const decidedAt = now.toISOString();
  const refs = orderRefs(order);
  const via = decider.via ? { via: decider.via } : {};

  if (Date.parse(order.offer.expiresAt) <= now.getTime()) {
    const rejected: Order = { ...order, status: "rejected", updatedAt: decidedAt };
    await deps.audit.append({
      actor: SUPPLIER_ACTOR,
      event: "approval.rejected",
      summary: summaries.expired(order),
      refs,
      data: { reason: "offer_expired", expiresAt: order.offer.expiresAt, requestedDecision: body.decision, ...via },
    });
    return save(order, rejected, deps);
  }

  const { mandate } = await deps.mandates.current(order.buyer.id);
  const approver = mandate.approval.approver;
  const offerHash = await deps.hash(order.offer);
  const jws = await deps.trust.sign(
    "approver",
    { orderId: order.id, offerId: order.offer.id, offerHash, decision: body.decision, decidedAt },
    { typ: "approval+jwt" },
  );
  const approval: Approval = { decidedBy: approver, decision: body.decision, decidedAt, note: body.note, jws };
  const decided: Order = { ...order, approval, updatedAt: decidedAt };
  const human = { type: "human" as const, id: approver.id, name: approver.name };

  if (body.decision === "rejected") {
    await deps.audit.append({
      actor: human,
      event: "approval.rejected",
      summary: summaries.rejected(order, approver.name, body.note),
      refs,
      data: { note: body.note, approvalJws: jws, ...via },
    });
    return save(order, { ...decided, status: "rejected" }, deps);
  }

  await deps.audit.append({
    actor: human,
    event: "approval.granted",
    summary: summaries.granted(order, approver.name),
    refs,
    data: { note: body.note, approvalJws: jws, ...via },
  });
  return save(order, await confirmOrder(decided, summaries.confirmedApproved(order, approver.name), deps), deps);
}
