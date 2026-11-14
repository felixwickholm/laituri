import type { Approval, ApprovalDecisionRequest, Order } from "@/lib/contracts";
import { NotFoundError, StateError } from "@/lib/gateway/errors";
import { holdEnd } from "@/lib/offers/reservations";
import { TOKEN_TYPE } from "@/lib/trust/types";
import { saveThenLog, stored } from "./commit";
import { confirmOrder } from "./confirm";
import { serial } from "./lock";
import { recheckOrder } from "./recheck";
import { SUPPLIER_ACTOR, nonPassing, orderRefs, summaries } from "./summaries";
import type { AuditInput, Decider, OrderDeps, StoredOrder } from "./types";

/** Saves the decided order under the key it was placed with, then logs the decision; the log never runs ahead. */
async function record(previous: StoredOrder, next: Order, entry: AuditInput, deps: OrderDeps): Promise<Order> {
  await saveThenLog(previous, stored(next, previous.idempotencyKey), entry, deps);
  return next;
}

/**
 * The approver of the order's buyer decides a pending order. The decision is signed with the approver key.
 * Another buyer's approver cannot see the order. The wholesaler held the offer's price until the order cut-off;
 * once that hold ends the order cannot be confirmed, so it is rejected and the reason audited. An approval re-checks
 * the order against the mandate in force and the stock the wholesaler has now: what the "ask" tier flagged is the
 * approver's to decide, but a "never" rule, an invalid or expired mandate, an offer no longer valid or already used,
 * or stock taken meanwhile stops it, and the order is blocked with the reason audited.
 */
export function decideApproval(orderId: string, body: ApprovalDecisionRequest, deps: OrderDeps, decider: Decider): Promise<Order> {
  return serial(() => decide(orderId, body, deps, decider));
}

async function decide(orderId: string, body: ApprovalDecisionRequest, deps: OrderDeps, decider: Decider): Promise<Order> {
  const order: StoredOrder | undefined = await deps.store.orders.get(orderId);
  if (!order || order.buyer.id !== decider.buyerId) throw new NotFoundError(`Order ${orderId} was not found.`);
  if (order.status !== "pending_approval") {
    throw new StateError(`Order ${orderId} is ${order.status.replace("_", " ")} and does not wait for approval.`);
  }
  const now = deps.now();
  const decidedAt = now.toISOString();
  const refs = orderRefs(order);
  const via = decider.via ? { via: decider.via } : {};

  if (Date.parse(holdEnd(order)) <= now.getTime()) {
    return record(order, { ...order, status: "rejected", updatedAt: decidedAt }, {
      actor: SUPPLIER_ACTOR,
      event: "approval.rejected",
      summary: summaries.expired(order),
      refs,
      data: { reason: "offer_expired", heldUntil: holdEnd(order), requestedDecision: body.decision, ...via },
    }, deps);
  }

  if (body.decision === "approved") {
    const recheck = await recheckOrder(order, deps, now);
    if (recheck.outcome === "blocked") {
      const blocked: Order = { ...order, status: "blocked", decision: recheck, updatedAt: decidedAt };
      return record(order, blocked, {
        actor: SUPPLIER_ACTOR,
        event: "order.blocked",
        summary: summaries.stoppedAtApproval(blocked),
        refs,
        data: { reason: "mandate_recheck", requestedDecision: body.decision, checks: nonPassing(recheck), ...via },
      }, deps);
    }
  }

  const { mandate } = await deps.mandates.current(order.buyer.id);
  const approver = mandate.approval.approver;
  const offerHash = await deps.hash(order.offer);
  const jws = await deps.trust.sign(
    "approver",
    { orderId: order.id, offerId: order.offer.id, offerHash, decision: body.decision, decidedAt },
    TOKEN_TYPE.approval,
  );
  const approval: Approval = { decidedBy: approver, decision: body.decision, decidedAt, note: body.note, jws };
  const decided: Order = { ...order, approval, updatedAt: decidedAt };
  const human = { type: "human" as const, id: approver.id, name: approver.name };

  if (body.decision === "rejected") {
    return record(order, { ...decided, status: "rejected" }, {
      actor: human,
      event: "approval.rejected",
      summary: summaries.rejected(order, approver.name, body.note),
      refs,
      data: { note: body.note, approvalJws: jws, ...via },
    }, deps);
  }

  await record(order, decided, {
    actor: human,
    event: "approval.granted",
    summary: summaries.granted(order, approver.name),
    refs,
    data: { note: body.note, approvalJws: jws, ...via },
  }, deps);
  return confirmOrder(stored(decided, order.idempotencyKey), decided, summaries.confirmedApproved(order, approver.name), order.idempotencyKey, deps);
}
