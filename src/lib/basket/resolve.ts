import { randomUUID } from "node:crypto";
import type { Basket, Order, SignedOffer } from "@/lib/contracts";
import { now } from "@/lib/clock";
import { gateway } from "@/lib/gateway";
import { StateError, ValidationError } from "@/lib/gateway/errors";
import { createHandoff } from "@/lib/handoffs";
import { deciderOf, type ApproverSession } from "@/lib/http/console-session";
import { DEMO_VIA } from "@/lib/http/sign-in";
import { decodeUnverified } from "@/lib/orders/read-offer";
import { store } from "@/lib/store";
import { workspaceState } from "@/lib/workspace/context";
import { classifyOrder } from "./classify";
import { storedBasket } from "./records";
import type { HeldOption, StoredBasket, StoredLine } from "./types";
import { recordRefusedChoice, recordResolution, settleLine, shortfallReason } from "./settle";
import { toBasket } from "./view";

/** Resolutions in one workspace run one at a time, so two clicks cannot order the same line twice. */
const queue = workspaceState<{ last: Promise<unknown> }>("basket.resolve", () => ({ last: Promise.resolve() }));

function serial<T>(work: () => Promise<T>): Promise<T> {
  const state = queue();
  const next = state.last.catch(() => undefined).then(work);
  state.last = next;
  return next;
}

/** The held offer while it is still valid, else a fresh quote for the same lines and words. */
async function offerFor(basket: StoredBasket, held: HeldOption): Promise<SignedOffer> {
  const claims = held.offerJws ? decodeUnverified(held.offerJws) : undefined;
  const expiresAt = claims && typeof claims === "object" && "expiresAt" in claims ? String(claims.expiresAt) : undefined;
  if (held.offerJws && expiresAt && Date.parse(expiresAt) > now().getTime()) {
    return { offer: claims as SignedOffer["offer"], jws: held.offerJws };
  }
  if (!held.quote) throw new StateError("This option can no longer be ordered. Ask Valio Aimo instead.");
  const response = await gateway().requestQuote(basket.agent, {
    lines: held.quote.lines,
    deliverBy: basket.deliverBy,
    intent: held.quote.words,
    matchConfidence: "high",
  });
  return response.primary;
}

/** The person's signature on a waiting order, the existing approval with every re-check it makes. */
function decide(orderId: string, decision: "approved" | "rejected", session: ApproverSession, note: string): Promise<Order> {
  return gateway().decideApproval(orderId, { decision, note }, deciderOf(session));
}

/**
 * The waiting order the line held, rejected once the option the person chose in its place was placed and stands:
 * confirmed, or waiting for a person itself. Until then the waiting order is the line's, and it stays.
 */
async function releaseWaiting(heldOrderId: string | undefined, replacement: Order, basket: StoredBasket, session: ApproverSession): Promise<void> {
  if (!heldOrderId || heldOrderId === replacement.id) return;
  const order = await store().orders.get(heldOrderId);
  if (order?.buyer.id === basket.buyer.id && order.status === "pending_approval") {
    await decide(order.id, "rejected", session, "Replaced by another option in the basket.");
  }
}

/** An option that would order a line already ordered is refused: the order a person approved elsewhere stands. */
async function refuseWhenOrdered(line: StoredLine): Promise<void> {
  const order = line.orderId ? await store().orders.get(line.orderId) : undefined;
  if (order?.status === "confirmed") throw new StateError(`${line.words} is already ordered. Nothing else was ordered.`);
}

/** Orders the option a person chose; when a "never" rule blocks it, the line and any order it holds stay as they were. */
async function chooseInstead(
  line: StoredLine,
  basket: StoredBasket,
  held: HeldOption,
  option: { id: string; label: string },
  session: ApproverSession,
  verb: string,
): Promise<{ sentence: string; refused?: true }> {
  await refuseWhenOrdered(line);
  const heldOrderId = line.orderId;
  const order = await orderChosen(basket, held, session, option.label);
  if (order.status !== "confirmed" && order.status !== "pending_approval") {
    const { mandate } = await gateway().getMandate(basket.buyer.id);
    const why = classifyOrder(order, mandate, { history: { timesOrdered: 0 }, sameAsLastWeek: false }).reason.replace(/ ?Nothing (was )?ordered\.$/, "");
    const sentence = `${why} ${heldOrderId ? "Your waiting order is kept." : "Nothing was ordered."}`;
    line.reason = sentence;
    line.options = (line.options ?? []).filter((candidate) => candidate.id !== option.id);
    delete line.held[option.id];
    return { sentence, refused: true };
  }
  await releaseWaiting(heldOrderId, order, basket, session);
  let sentence = await settleOrder(line, basket, order, "the purchasing manager", verb);
  const short = held.kind === "quantity" && line.state === "green" ? shortfallReason(line, order) : undefined;
  if (short) sentence = line.reason = short;
  return { sentence };
}

/** The buyer's agent orders the chosen offer; when the mandate asks a person, the person who chose it signs. */
async function orderChosen(basket: StoredBasket, held: HeldOption, session: ApproverSession, label: string): Promise<Order> {
  const signed = await offerFor(basket, held);
  const { jws: mandateJws } = await gateway().getMandate(basket.buyer.id);
  const order = await gateway().placeOrder(basket.agent, { offerJws: signed.jws, mandateJws, idempotencyKey: randomUUID() });
  if (order.status !== "pending_approval") return order;
  return decide(order.id, "approved", session, `Chosen in the basket: ${label}.`);
}

async function settleOrder(line: StoredLine, basket: StoredBasket, order: Order, who: string, verb: string): Promise<string> {
  const { mandate } = await gateway().getMandate(basket.buyer.id);
  return settleLine(line, order, mandate, await store().orders.list(), who, verb);
}

/**
 * Applies one option a person chose on an orange or red line, as the signed-in approver of the basket's buyer. Every
 * order still goes through the gateway: a "never" rule blocks it whoever chose it. The choice is a signed audit entry.
 */
export function resolveLine(basketId: string, lineId: string, optionId: string, session: ApproverSession): Promise<Basket> {
  return serial(async () => {
    const basket = await storedBasket(basketId, session.buyer.id);
    const line = basket.lines.find((candidate) => candidate.id === lineId);
    if (!line) throw new ValidationError(`Basket ${basketId} has no line ${lineId}.`);
    const option = line.options?.find((candidate) => candidate.id === optionId);
    const held = line.held[optionId];
    if (!option || !held) throw new ValidationError(`Option ${optionId} is not on line ${lineId}. Choose one of the line's options.`);
    // Screens name the role; the signed audit entry below names the person.
    const who = "the purchasing manager";
    const person = { ...session.approver, ...(session.demo ? { via: DEMO_VIA } : {}) };
    // A swap, what is in stock, or a line held back before ordering (it drifted) orders something new.
    if (held.kind === "substitute" || held.kind === "quantity" || (held.kind === "approve" && !held.orderId)) {
      const verb = held.kind === "approve" ? "Approved" : held.kind === "quantity" ? "Changed" : "Swapped";
      const chosen = await chooseInstead(line, basket, held, option, session, verb);
      if (chosen.refused) await recordRefusedChoice(basket, line, option, person, chosen.sentence);
      else await recordResolution(basket, line, option, person, chosen.sentence);
      await store().baskets.put(basket);
      return toBasket(basket);
    }
    let sentence: string;
    switch (held.kind) {
      case "approve":
        sentence = await settleOrder(line, basket, await decide(held.orderId ?? "", "approved", session, "Approved in the basket."), who, "Approved");
        break;
      case "skip":
        if (held.orderId) await decide(held.orderId, "rejected", session, "Left out of the basket.");
        sentence = `Left out by ${who}.`;
        Object.assign(line, { state: "red", reason: sentence, options: [], held: {} });
        break;
      case "handoff": {
        const handoff = await createHandoff(
          { basketId, lineId, ...(line.orderId ? { orderId: line.orderId } : {}), words: `Please help with ${line.words}. ${line.reason}` },
          session,
        );
        sentence = `The purchasing manager asked Valio Aimo. ${handoff.openHours.sentence}`;
        break;
      }
    }
    await recordResolution(basket, line, option, person, sentence);
    await store().baskets.put(basket);
    return toBasket(basket);
  });
}
