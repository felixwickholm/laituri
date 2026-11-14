import type { Mandate, Order } from "@/lib/contracts";
import { shortDay } from "../dates";
import { offerSubject } from "../purchase";
import type { NoteStatus, PurchaseStatus } from "../types";
import { euro, personName } from "../words";

export interface OrderOutcome {
  status: PurchaseStatus;
  note: string;
  noteStatus: NoteStatus;
  summary: string;
}

/** The gateway's verdict on an order, in the same words the scripted agent uses. */
export function orderOutcome(order: Order, mandate: Mandate): OrderOutcome {
  const approver = personName(mandate.approval.approver.name);
  const subject = `${offerSubject(order.offer)}, ${euro(order.offer.totals.net.amount)} net`;
  if (order.status === "confirmed") {
    const when = order.offer.deliveryDate ? `, delivery ${shortDay(order.offer.deliveryDate)}` : "";
    return {
      status: "confirmed",
      note: "Inside my mandate. Order placed.",
      noteStatus: "ok",
      summary: `Order ${order.id} confirmed: ${subject}${when}.`,
    };
  }
  if (order.status === "pending_approval") {
    const ask = order.decision.checks.find((check) => check.status === "ask");
    const reason = ask?.rule === "spend.per_order"
      ? `Over my limit of ${euro(mandate.limits.perOrder.amount, true)}.`
      : ask?.message ?? "A person must decide.";
    return {
      status: "waiting",
      note: `${reason} Waiting for ${approver}.`,
      noteStatus: "waiting",
      summary: `Order ${order.id} is waiting for ${approver}: ${subject}. ${reason}`,
    };
  }
  const block = order.decision.checks.find((check) => check.status === "block");
  const reason = block?.message ?? "The order is outside my mandate.";
  return {
    status: "blocked",
    note: `Blocked. ${reason}`,
    noteStatus: "blocked",
    summary: `Order ${order.id} was blocked: ${reason} Nothing was ordered.`,
  };
}
