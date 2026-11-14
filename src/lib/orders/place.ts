import type { Order, PlaceOrderRequest } from "@/lib/contracts";
import { ConflictError } from "@/lib/gateway/errors";
import { newId } from "@/lib/offers/assemble";
import { confirmOrder } from "./confirm";
import { serial } from "./lock";
import { orderedProductIds, productsFor, weekSpendNet } from "./context";
import { decodeUnverified, readOffer } from "./read-offer";
import { SUPPLIER_ACTOR, agentActor, nonPassing, summaries } from "./summaries";
import type { Caller, MandateRead, OfferRead, OrderDeps, StoredOrder } from "./types";

export const UNKNOWN_AGENT = { id: "unknown", name: "Unknown agent" };
/** The offer names no buyer, so an order without a valid mandate cannot say whose it is. */
const UNVERIFIED_BUYER = { id: "unverified", name: "Unverified buyer" };

/** Retries that arrive while the first attempt is still running share its result. */
const inFlight = new Map<string, Promise<Order>>();

function claimedOfferId(jws: string): string | undefined {
  const payload = decodeUnverified(jws);
  return payload && typeof payload === "object" && "id" in payload ? String(payload.id) : undefined;
}

async function existingOrder(request: PlaceOrderRequest, deps: OrderDeps): Promise<Order | undefined> {
  const existing = await deps.store.orders.byIdempotencyKey(request.idempotencyKey);
  if (!existing) return undefined;
  if (claimedOfferId(request.offerJws) !== existing.offer.id) {
    throw new ConflictError("This idempotency key was already used for a different offer. Use a new key.");
  }
  return existing;
}

/**
 * Verify the offer and the mandate, check the order against the mandate and record it.
 * Problems with signatures or rules produce a blocked order, not an exception, so every attempt is on record.
 */
export async function placeOrder(request: PlaceOrderRequest, deps: OrderDeps, caller?: Caller): Promise<Order> {
  const existing = await existingOrder(request, deps);
  if (existing) return existing;
  const running = inFlight.get(request.idempotencyKey);
  if (running) {
    const order = await running;
    if (claimedOfferId(request.offerJws) !== order.offer.id) {
      throw new ConflictError("This idempotency key was already used for a different offer. Use a new key.");
    }
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

/** A fixed-price offer covers one order. A second order needs a new quote, so stock is not promised twice. */
function singleUse<T extends OfferRead>(read: T, orders: Order[]): T {
  if (!read.valid || !read.offer) return read;
  const used = orders.find((o) => o.offer.id === read.offer?.id && (o.status === "confirmed" || o.status === "pending_approval"));
  return used ? { ...read, valid: false, reason: `This offer was already used for order ${used.id}. Ask for a new quote.` } : read;
}

/** Only the mandate in force counts. An older copy stays correctly signed after the buyer tightens the limits. */
async function currentOnly(read: MandateRead, deps: OrderDeps): Promise<MandateRead> {
  if (!read.valid || !read.mandate) return read;
  const { mandate: current } = await deps.mandates.current();
  if (current.id === read.mandate.id && current.version === read.mandate.version) return read;
  return { ...read, valid: false, reason: "This mandate was replaced by a newer version. Read the current mandate and try again." };
}

async function createOrder(request: PlaceOrderRequest, deps: OrderDeps, caller?: Caller): Promise<Order> {
  const allOrders = await deps.store.orders.list();
  const offerRead = singleUse(await readOffer(request.offerJws, deps), allOrders);
  const mandateRead = await currentOnly(await deps.mandates.read(request.mandateJws), deps);
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
    agent: caller ?? mandate?.agent ?? UNKNOWN_AGENT,
    buyer: mandate ? { id: mandate.buyer.id, name: mandate.buyer.name } : UNVERIFIED_BUYER,
    offer: offerRead.offer,
    decision: { outcome: "blocked", checks: [] },
    simulated: true,
  };
  const refs = { orderId: draft.id, offerId: draft.offer.id, mandateId: draft.mandateId };
  await deps.audit.append({
    actor: agentActor(caller ?? draft.agent),
    event: "order.requested",
    summary: summaries.requested(draft),
    refs,
    data: { idempotencyKey: request.idempotencyKey, totals: draft.offer.totals, fulfilment: draft.offer.fulfilment },
  });

  const decision = await deps.policy.evaluate({
    mandate: mandateRead,
    offer: offerRead,
    products: productsFor(offerRead.offer, deps),
    agentId: caller?.id ?? draft.agent.id,
    weekSpendNet: weekSpendNet(allOrders, buyerId, now),
    orderedProductIds: orderedProductIds(allOrders, buyerId),
    now,
  });
  await deps.audit.append({
    actor: SUPPLIER_ACTOR,
    event: "policy.evaluated",
    summary: summaries.evaluated(decision),
    refs,
    data: { outcome: decision.outcome, checks: nonPassing(decision) },
  });

  const evaluated: Order = { ...draft, decision };
  const order = await settle(evaluated, deps, mandate?.approval.approver.name ?? "the approver");
  const stored: StoredOrder = { ...order, idempotencyKey: request.idempotencyKey };
  await deps.store.orders.put(stored);
  return order;
}

async function settle(order: Order, deps: OrderDeps, approver: string): Promise<Order> {
  const refs = { orderId: order.id, offerId: order.offer.id, mandateId: order.mandateId };
  switch (order.decision.outcome) {
    case "auto_approved":
      return confirmOrder(order, summaries.confirmedAuto(order), deps);
    case "needs_approval": {
      const pending: Order = { ...order, status: "pending_approval" };
      await deps.audit.append({
        actor: SUPPLIER_ACTOR,
        event: "approval.requested",
        summary: summaries.approvalRequested(pending, approver),
        refs,
        data: { approver, checks: nonPassing(order.decision) },
      });
      return pending;
    }
    case "blocked": {
      const blocked: Order = { ...order, status: "blocked" };
      await deps.audit.append({
        actor: SUPPLIER_ACTOR,
        event: "order.blocked",
        summary: summaries.blocked(blocked),
        refs,
        data: { checks: nonPassing(order.decision) },
      });
      return blocked;
    }
  }
}
