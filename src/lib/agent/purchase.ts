import { randomUUID } from "node:crypto";
import type { Mandate, Offer, Order } from "@/lib/contracts";
import { now } from "@/lib/clock";
import { shortDay } from "./dates";
import { findCandidates } from "./find";
import { parseRequest } from "./parse-request";
import { selectOffer } from "./select-offer";
import type { AgentHooks, AgentTransport, NoteStatus, PurchaseResult, PurchaseStatus, PurchaseStep } from "./types";
import { amount, euro, personName, quantityText } from "./words";

/** "1,000 x Valio Eila 1 l" or "51 x A and 149 x B". */
export function offerSubject(offer: Offer): string {
  return offer.lines
    .filter((line) => line.quantity > 0)
    .map((line) => `${amount(line.quantity)} x ${line.name}`)
    .join(" and ");
}

function validMinutes(offer: Offer): number {
  return Math.round((Date.parse(offer.expiresAt) - Date.parse(offer.issuedAt)) / 60000);
}

function outcome(order: Order, mandate: Mandate): { status: PurchaseStatus; note: string; summary: string } {
  const approver = personName(mandate.approval.approver.name);
  const subject = `${offerSubject(order.offer)}, ${euro(order.offer.totals.net.amount)} net`;
  if (order.status === "confirmed") {
    const when = order.offer.deliveryDate ? `, delivery ${shortDay(order.offer.deliveryDate)}` : "";
    return { status: "confirmed", note: "Inside my mandate. Order placed.", summary: `Order ${order.id} confirmed: ${subject}${when}.` };
  }
  if (order.status === "pending_approval") {
    const ask = order.decision.checks.find((check) => check.status === "ask");
    const reason = ask?.rule === "spend.per_order"
      ? `Over my limit of ${euro(mandate.limits.perOrder.amount, true)}.`
      : ask?.message ?? "A person must decide.";
    return {
      status: "waiting",
      note: `${reason} Waiting for ${approver}.`,
      summary: `Order ${order.id} is waiting for ${approver}: ${subject}. ${reason}`,
    };
  }
  const block = order.decision.checks.find((check) => check.status === "block");
  const reason = block?.message ?? (order.status === "rejected" ? "The order was rejected." : "The order is outside my mandate.");
  return { status: "blocked", note: `Blocked. ${reason}`, summary: `Order ${order.id} was blocked: ${reason} Nothing was ordered.` };
}

/**
 * The buyer's purchasing agent: read the request, find the cheapest product that covers it, get a signed
 * offer, and place one order under the mandate. It never retries after a block or while waiting for a person.
 */
export async function runPurchase(requestText: string, transport: AgentTransport, hooks: AgentHooks): Promise<PurchaseResult> {
  const steps: PurchaseStep[] = [];
  const say = async (text: string, status: NoteStatus = "ok") => {
    steps.push({ text, status });
    await hooks.note(text, status);
  };
  const finish = async (status: PurchaseStatus, summary: string, extra: Partial<PurchaseResult> = {}, noteStatus?: NoteStatus) => {
    if (noteStatus) await say(summary, noteStatus);
    return { status, summary, steps, ...extra };
  };

  try {
    const parsed = parseRequest(requestText, now());
    const what = parsed.phrase || (parsed.productId ? `product ${parsed.productId}` : "the product");
    if (!parsed.quantity) return finish("needs_input", `I need a quantity. How much ${what} do you need?`, {}, "waiting");
    const quantity = parsed.quantity;
    const by = `by ${shortDay(parsed.deliverBy)}${parsed.deliverByStated ? "" : " (next working day)"}`;
    await say(`Looking for ${what}, ${quantityText(quantity)}, ${by}.`);
    await hooks.pause();

    const candidates = await findCandidates(parsed, transport);
    if (candidates.products.length === 0) {
      const why = candidates.matches > 0 ? " The matches are sold in another unit." : "";
      return finish("not_found", `Found nothing that matches "${what}".${why} No order placed.`, {}, "error");
    }
    if (candidates.confidence === "low") await say(`The match is uncertain. ${candidates.note ?? ""}`.trim(), "waiting");
    await hooks.pause();

    const selection = await selectOffer({
      parsed: { ...parsed, quantity },
      products: candidates.products,
      confidence: candidates.confidence,
      transport,
      say: (text) => say(text),
      pause: () => hooks.pause(),
    });
    if ("failure" in selection) return finish("failed", `${selection.failure} No order placed.`, {}, "error");
    const { offer, jws } = selection.signed;
    await say(`Offer signed by ${offer.issuer}: ${offerSubject(offer)}, ${euro(offer.totals.gross.amount)} with VAT. Valid ${validMinutes(offer)} minutes.`);
    await hooks.pause();

    const { jws: mandateJws, mandate } = await transport.getMandate();
    const order = await transport.placeOrder({ offerJws: jws, mandateJws, idempotencyKey: randomUUID() });
    const result = outcome(order, mandate);
    const noteStatus: NoteStatus = result.status === "confirmed" ? "ok" : result.status === "waiting" ? "waiting" : "blocked";
    await say(result.note, noteStatus);
    return finish(result.status, result.summary, { orderId: order.id, offerId: offer.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return finish("failed", `Something went wrong: ${message} No order placed.`, {}, "error");
  }
}
