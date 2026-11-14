import type { Order, PlaceOrderRequest, Refusal } from "@/lib/contracts";
import { ConflictError } from "@/lib/gateway/errors";
import { newId } from "@/lib/offers/assemble";
import { seededMark } from "@/lib/provenance";
import { workspaceState } from "@/lib/workspace/context";
import { saveThenLog, stored } from "./commit";
import { completeReceipt, confirmOrder } from "./confirm";
import { serial } from "./lock";
import { orderedProductIds, productsFor, weekSpendNet } from "./context";
import { signPriceHold } from "./price-hold";
import { decodeUnverified, issuedHere, readOffer, singleUse } from "./read-offer";
import { REFUSALS } from "./refusals";
import { stockTakenSinceQuote } from "./stock";
import { SUPPLIER_ACTOR, agentActor, nonPassing, orderRefs, summaries } from "./summaries";
import type { Caller, MandateRead, OfferRead, OrderDeps } from "./types";

export const UNKNOWN_AGENT = { id: "unknown", name: "Unknown agent" };
/** The offer names no buyer, so an order without a valid mandate cannot say whose it is. */
const UNVERIFIED_BUYER = { id: "unverified", name: "Unverified buyer" };

/** Retries that arrive while the first attempt is still running share its result. Keys are per workspace. */
const ordersInFlight = workspaceState("orders.in-flight", () => new Map<string, Promise<Order>>());

function claimedOfferId(jws: string): string | undefined {
  const payload = decodeUnverified(jws);
  return payload && typeof payload === "object" && "id" in payload ? String(payload.id) : undefined;
}

function sameAttempt(order: Order, request: PlaceOrderRequest, caller?: Caller): boolean {
  // Another agent's key must not hand back that agent's order.
  return claimedOfferId(request.offerJws) === order.offer.id && (!caller || caller.id === order.agent.id);
}

const REUSED_KEY = "This idempotency key was already used for a different offer. Use a new key.";

/**
 * Verify the offer and the mandate, check the order against the mandate and record it.
 * Problems with signatures or rules produce a blocked order, not an exception, so every attempt is on record.
 * A retry with the same idempotency key returns the first outcome.
 */
export async function placeOrder(request: PlaceOrderRequest, deps: OrderDeps, caller?: Caller): Promise<Order> {
  const existing = await deps.store.orders.byIdempotencyKey(request.idempotencyKey);
  if (existing) {
    if (!sameAttempt(existing, request, caller)) throw new ConflictError(REUSED_KEY);
    return completeReceipt(existing, deps);
  }
  const inFlight = ordersInFlight();
  const running = inFlight.get(request.idempotencyKey);
  if (running) {
    const order = await running;
    if (!sameAttempt(order, request, caller)) throw new ConflictError(REUSED_KEY);
    return order;
  }
  const attempt = serial(() => createOrder(request, deps, caller));
  inFlight.set(request.idempotencyKey, attempt);
  try {
    return await attempt;
  } finally {
    inFlight.delete(request.idempotencyKey);
  }
}

/**
 * Only the mandate in force in this workspace counts, byte for byte. An older copy stays correctly signed after the
 * buyer tightens the limits; a copy with the same id and version from another workspace is refused.
 */
async function currentOnly(read: MandateRead, jws: string, deps: OrderDeps): Promise<MandateRead> {
  if (!read.valid || !read.mandate) return read;
  const current = await deps.mandates.current(read.mandate.buyer.id);
  if (current.jws === jws) return read;
  if (current.mandate.id === read.mandate.id && current.mandate.version !== read.mandate.version) {
    return { ...read, valid: false, reason: "This mandate was replaced by a newer version. Read the current mandate and try again." };
  }
  const refusal = REFUSALS.mandateElsewhere;
  return { ...read, valid: false, reason: refusal.message, refusal };
}

/** Why the order is refused as invalid, if it is: the offer's reason first, as the agent sent it first. */
function refusalOf(offer: OfferRead, mandate: MandateRead): { refusal: Refusal } | Record<string, never> {
  const refusal = offer.refusal ?? mandate.refusal;
  return refusal ? { refusal } : {};
}

async function createOrder(request: PlaceOrderRequest, deps: OrderDeps, caller?: Caller): Promise<Order> {
  const allOrders = await deps.store.orders.list();
  const offerRead = singleUse(await issuedHere(await readOffer(request.offerJws, deps), request.offerJws, deps), allOrders);
  const mandateRead = await currentOnly(await deps.mandates.read(request.mandateJws), request.mandateJws, deps);
  const mandate = mandateRead.mandate;
  const now = deps.now();
  const at = now.toISOString();
  const buyerId = mandate?.buyer.id ?? UNVERIFIED_BUYER.id;

  const draft: Order = {
    id: newId("ord_"),
    status: "blocked",
    createdAt: at,
    updatedAt: at,
    mandateId: mandate?.id ?? "unknown",
    agent: caller ? { id: caller.id, name: caller.name } : mandate?.agent ?? UNKNOWN_AGENT,
    buyer: caller?.buyer ?? (mandate ? { id: mandate.buyer.id, name: mandate.buyer.name } : UNVERIFIED_BUYER),
    offer: offerRead.offer,
    decision: { outcome: "blocked", checks: [] },
    simulated: true,
    ...refusalOf(offerRead, mandateRead),
    ...seededMark(),
  };
  const refs = orderRefs(draft);
  await deps.audit.append({
    actor: agentActor(caller ?? draft.agent),
    event: "order.requested",
    summary: summaries.requested(draft),
    refs,
    data: { idempotencyKey: request.idempotencyKey, totals: draft.offer.totals, fulfilment: draft.offer.fulfilment },
  });

  const stockTaken = offerRead.valid ? stockTakenSinceQuote(offerRead.offer, allOrders, now) : undefined;
  const decision = await deps.policy.evaluate({
    mandate: mandateRead,
    offer: offerRead,
    products: productsFor(offerRead.offer, deps),
    agentId: caller?.id ?? draft.agent.id,
    weekSpendNet: weekSpendNet(allOrders, buyerId, now),
    orderedProductIds: orderedProductIds(allOrders, buyerId),
    now,
    auditLog: await deps.audit.verify(),
    ...(stockTaken ? { stockTaken } : {}),
  });
  await deps.audit.append({
    actor: SUPPLIER_ACTOR,
    event: "policy.evaluated",
    summary: summaries.evaluated(decision),
    refs,
    data: { outcome: decision.outcome, checks: nonPassing(decision) },
  });

  return settle({ ...draft, decision }, request.idempotencyKey, deps, mandate?.approval.approver.name ?? "the approver");
}

/** Saves the outcome, then logs it: a confirmation, a wait for a person with the price held, or a block. */
async function settle(order: Order, idempotencyKey: string, deps: OrderDeps, approver: string): Promise<Order> {
  const refs = orderRefs(order);
  switch (order.decision.outcome) {
    case "auto_approved":
      return confirmOrder(undefined, order, summaries.confirmedAuto(order), idempotencyKey, deps);
    case "needs_approval": {
      const pending: Order = { ...order, status: "pending_approval" };
      const priceHold = await signPriceHold(pending, deps);
      const held: Order = { ...pending, priceHold };
      await saveThenLog(undefined, stored(held, idempotencyKey), {
        actor: SUPPLIER_ACTOR,
        event: "approval.requested",
        summary: summaries.approvalRequested(held, approver),
        refs,
        data: { approver, checks: nonPassing(order.decision), priceHold },
      }, deps);
      return held;
    }
    case "blocked": {
      const blocked: Order = { ...order, status: "blocked" };
      await saveThenLog(undefined, stored(blocked, idempotencyKey), {
        actor: SUPPLIER_ACTOR,
        event: "order.blocked",
        summary: summaries.blocked(blocked),
        refs,
        data: { checks: nonPassing(order.decision), ...(blocked.refusal ? { refusal: blocked.refusal.code } : {}) },
      }, deps);
      return blocked;
    }
  }
}
