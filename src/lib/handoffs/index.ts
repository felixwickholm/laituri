import type { CreateHandoffRequest, Handoff } from "@/lib/contracts";
import { appendAudit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { NotFoundError, StateError } from "@/lib/gateway/errors";
import type { Operator } from "@/lib/gateway/types";
import type { ApproverSession } from "@/lib/http/console-session";
import { DEMO_VIA } from "@/lib/http/sign-in";
import { newId } from "@/lib/offers/assemble";
import { SUPPLIER_ACTOR } from "@/lib/orders/summaries";
import { store } from "@/lib/store";
import { weeklyCutoff } from "@/lib/basket/weekly";
import { openHours, type HandoffTiming } from "./open-hours";

export { openHours, type HandoffTiming } from "./open-hours";

/** What the question is about, checked to belong to the asking buyer: a basket line, an order, or nothing named. */
async function contextOf(input: CreateHandoffRequest, buyerId: string): Promise<Handoff["context"]> {
  const named = { ...(input.basketId ? { basketId: input.basketId } : {}), ...(input.lineId ? { lineId: input.lineId } : {}), ...(input.orderId ? { orderId: input.orderId } : {}) };
  if (input.basketId) {
    const basket = await store().baskets.get(input.basketId);
    if (!basket || basket.buyer.id !== buyerId) throw new NotFoundError(`Basket ${input.basketId} was not found.`);
    const line = input.lineId ? basket.lines.find((candidate) => candidate.id === input.lineId) : undefined;
    if (input.lineId && !line) throw new NotFoundError(`Basket ${input.basketId} has no line ${input.lineId}.`);
    return { ...named, summary: line ? `${line.words} in "${basket.title}": ${line.reason}` : `The basket "${basket.title}".` };
  }
  if (input.orderId) {
    const order = await store().orders.get(input.orderId);
    if (!order || order.buyer.id !== buyerId) throw new NotFoundError(`Order ${input.orderId} was not found.`);
    return { ...named, summary: `Order ${order.id}, ${order.status.replace("_", " ")}.` };
  }
  return { ...named, summary: "A question from the kitchen." };
}

/**
 * What decides how the answer's timing reads: the order cut-off of the delivery asked about, and whether an order of
 * the buyer still waits for a decision. A question about nothing in particular has neither.
 */
async function timingOf(context: Pick<Handoff["context"], "basketId" | "lineId" | "orderId">, buyerId: string): Promise<HandoffTiming> {
  const basket = context.basketId ? await store().baskets.get(context.basketId) : undefined;
  const line = context.lineId ? basket?.lines.find((candidate) => candidate.id === context.lineId) : undefined;
  const orderId = context.orderId ?? line?.orderId;
  const order = orderId ? await store().orders.get(orderId) : undefined;
  const own = order?.buyer.id === buyerId ? order : undefined;
  const hasOrder = own?.status === "pending_approval";
  // A confirmed order loses nothing by waiting, and a question about nothing in particular has no cut-off.
  const undecided = hasOrder || (line !== undefined && own?.status !== "confirmed");
  const deliverBy = basket?.deliverBy ?? own?.offer.deliverBy;
  const cutoff = undecided ? (own?.offer.orderBy ?? (deliverBy ? weeklyCutoff(deliverBy) : undefined)) : undefined;
  return { ...(cutoff ? { cutoff } : {}), ...(deliverBy ? { deliverBy } : {}), hasOrder };
}

/** The open-hours sentence as of now; an answered hand-off keeps what it said. */
async function current(handoff: Handoff): Promise<Handoff> {
  if (handoff.status !== "open") return handoff;
  return { ...handoff, openHours: openHours(now(), await timingOf(handoff.context, handoff.buyer.id)) };
}

/** The signed-in approver asks a person at Valio Aimo. A signed audit entry records it. */
export async function createHandoff(input: CreateHandoffRequest, session: ApproverSession): Promise<Handoff> {
  const at = now();
  const handoff: Handoff = {
    id: newId("hnd_"),
    at: at.toISOString(),
    buyer: session.buyer,
    // The screen names the role; the signed audit entry below names the person.
    from: "Purchasing manager",
    words: input.words,
    context: await contextOf(input, session.buyer.id),
    status: "open",
    openHours: openHours(at, await timingOf(input, session.buyer.id)),
  };
  await store().handoffs.put(handoff);
  await appendAudit({
    actor: { type: "human", id: session.approver.id, name: session.approver.name },
    event: "handoff.requested",
    summary: `${session.approver.name} asked Valio Aimo: ${handoff.context.summary}`,
    refs: { buyerId: session.buyer.id, ...(input.orderId ? { orderId: input.orderId } : {}) },
    data: { handoffId: handoff.id, words: handoff.words, context: handoff.context, ...(session.demo ? { via: DEMO_VIA } : {}) },
  });
  return handoff;
}

/** One buyer's hand-offs, or every one in the workspace when no buyer is named; newest first. */
export async function listHandoffs(buyerId?: string): Promise<Handoff[]> {
  const all = await store().handoffs.list();
  return Promise.all(all.filter((handoff) => !buyerId || handoff.buyer.id === buyerId).reverse().map(current));
}

/** A signed-in operator answers. Answering twice is refused. */
export async function answerHandoff(id: string, words: string, operator: Operator): Promise<Handoff> {
  const handoff = await store().handoffs.get(id);
  if (!handoff) throw new NotFoundError(`Hand-off ${id} was not found.`);
  if (handoff.status === "answered") throw new StateError(`Hand-off ${id} was already answered.`);
  const answered: Handoff = { ...handoff, status: "answered", answer: { at: now().toISOString(), by: operator.name, words } };
  await store().handoffs.put(answered);
  await appendAudit({
    actor: { ...SUPPLIER_ACTOR, id: operator.id, name: operator.name },
    event: "handoff.answered",
    summary: `${operator.name} answered ${handoff.buyer.name}: ${words}`,
    refs: { buyerId: handoff.buyer.id, ...(handoff.context.orderId ? { orderId: handoff.context.orderId } : {}) },
    data: { handoffId: id, words, ...(operator.via ? { via: operator.via } : {}) },
  });
  return answered;
}
