import type { Actor, Check, Decision, Order } from "@/lib/contracts";
import { ISSUER } from "@/lib/offers/assemble";
import { eur, offerSubject } from "@/lib/offers/format";

export const SUPPLIER_ACTOR: Actor = { type: "supplier", id: "valio-aimo", name: ISSUER };

export function agentActor(agent: { id: string; name: string }): Actor {
  return { type: "agent", id: agent.id, name: agent.name };
}

function what(order: Order): string {
  return `${offerSubject(order.offer)} for ${eur(order.offer.totals.net.amount)}`;
}

export function concerns(decision: Decision, status: Check["status"]): Check[] {
  return decision.checks.filter((check) => check.status === status);
}

/** The checks that did not pass, in the compact form kept in audit data. */
export function nonPassing(decision: Decision) {
  return decision.checks
    .filter((check) => check.status === "ask" || check.status === "block")
    .map(({ rule, status, message }) => ({ rule, status, message }));
}

export const summaries = {
  requested: (order: Order) => `${order.agent.name} asked to order ${what(order)}.`,

  evaluated(decision: Decision): string {
    const asks = concerns(decision, "ask");
    const blocks = concerns(decision, "block");
    if (decision.outcome === "auto_approved") return `All ${decision.checks.length} mandate checks passed.`;
    if (decision.outcome === "blocked") return `${blocks.length} of ${decision.checks.length} mandate checks block the order.`;
    return `${asks.length} of ${decision.checks.length} mandate checks need a human decision.`;
  },

  confirmedAuto: (order: Order) => `${order.agent.name} ordered ${what(order)}. Inside the mandate, no approval needed.`,

  confirmedApproved: (order: Order, approver: string) =>
    `${order.agent.name} ordered ${what(order)}. ${approver} approved it.`,

  approvalRequested(order: Order, approver: string): string {
    const reason = concerns(order.decision, "ask")[0]?.message;
    return `The order of ${what(order)} waits for approval by ${approver}.${reason ? ` ${reason}` : ""}`;
  },

  blocked(order: Order): string {
    const reason = concerns(order.decision, "block")[0]?.message;
    return `The order of ${what(order)} was blocked.${reason ? ` ${reason}` : ""}`;
  },

  granted: (order: Order, approver: string) => `${approver} approved the order of ${what(order)}.`,

  rejected: (order: Order, approver: string, note?: string) =>
    `${approver} rejected the order of ${what(order)}.${note ? ` Note: ${note}` : ""}`,

  expired: (order: Order) =>
    `The offer for ${what(order)} expired before approval, so the order was rejected.`,
};
