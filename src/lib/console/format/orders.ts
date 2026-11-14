import type { Order } from "@/lib/contracts";
import type { SignedMandate } from "../types";
import { blocks, handledState, ruleName, shortName } from "./rules";
import { helsinkiDate, weekStart } from "./week";

export type OutcomeKey = "auto" | "approved" | "waiting" | "rejected" | "blocked";
export type OutcomeTone = "success" | "waiting" | "danger" | "neutral";

export interface OrderOutcome {
  key: OutcomeKey;
  label: string;
  tone: OutcomeTone;
  /** The rule that stopped a blocked order, in plain words. */
  rule?: string;
}

/** The orders placed for the buyer whose mandate the console shows. Before the mandate loads, all of them. */
export function buyerOrders(orders: Order[], mandate: SignedMandate | undefined): Order[] {
  const buyerId = mandate?.mandate.buyer.id;
  return buyerId ? orders.filter((order) => order.buyer.id === buyerId) : orders;
}

export function newestFirst(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** How an order ended, in the words of the orders table: "Confirmed automatically", "Approved by Maria Lind". */
export function orderOutcome(order: Order): OrderOutcome {
  if (order.status === "pending_approval") return { key: "waiting", label: "Waiting for you", tone: "waiting" };
  const who = order.approval ? shortName(order.approval.decidedBy.name) : undefined;
  switch (handledState(order)) {
    case "blocked": {
      const [first] = blocks(order);
      return { key: "blocked", label: "Blocked", tone: "danger", rule: first ? ruleName(first.rule) : "Outside the mandate" };
    }
    case "approved":
      return { key: "approved", label: `Approved by ${who}`, tone: "success" };
    case "rejected":
      return { key: "rejected", label: `Rejected by ${who}`, tone: "neutral" };
    case "expired":
      return { key: "rejected", label: "Expired before a decision", tone: "neutral" };
    default:
      return { key: "auto", label: "Confirmed automatically", tone: "success" };
  }
}

/** The filter chips over the orders table, in the order a buyer reads them. */
export const OUTCOME_FILTERS: { key: OutcomeKey; label: string }[] = [
  { key: "auto", label: "Confirmed automatically" },
  { key: "approved", label: "Approved" },
  { key: "waiting", label: "Waiting" },
  { key: "rejected", label: "Rejected" },
  { key: "blocked", label: "Blocked" },
];

export interface WeekStats {
  spent: number;
  confirmed: number;
  confirmedAuto: number;
  confirmedApproved: number;
  waiting: number;
  waitingAmount: number;
  blocked: number;
}

function inWeek(order: Order, start: string): boolean {
  const at = Date.parse(order.createdAt);
  return !Number.isNaN(at) && helsinkiDate(at).date >= start;
}

/** This ISO week's figures for the Today strip, summed in whole cents so they match the rows. */
export function weekStats(orders: Order[], nowMs: number): WeekStats {
  const start = weekStart(nowMs);
  const week = orders.filter((order) => inWeek(order, start));
  const confirmed = week.filter((order) => order.status === "confirmed");
  const waiting = orders.filter((order) => order.status === "pending_approval");
  const cents = (list: Order[]) => list.reduce((sum, order) => sum + Math.round(order.offer.totals.net.amount * 100), 0) / 100;
  return {
    spent: cents(confirmed),
    confirmed: confirmed.length,
    confirmedAuto: confirmed.filter((order) => !order.approval).length,
    confirmedApproved: confirmed.filter((order) => Boolean(order.approval)).length,
    waiting: waiting.length,
    waitingAmount: cents(waiting),
    blocked: week.filter((order) => order.status === "blocked").length,
  };
}

/** Records written at start-up as demo history carry `seeded: true`; live use never does. */
export function isSeeded(record: object): boolean {
  return (record as { seeded?: unknown }).seeded === true;
}
