import type { AuditEntry, Order } from "@/lib/contracts";
import { asks, askSentence } from "@/lib/console/format/rules";

export type OrderPhase = "pending" | "expired" | "decided" | "blocked";

/** Where the order stands for the person holding the phone. An offer past its expiry cannot be approved. */
export function orderPhase(order: Order, nowMs: number): OrderPhase {
  if (order.status === "blocked") return "blocked";
  if (order.status === "pending_approval") return Date.parse(order.offer.expiresAt) <= nowMs ? "expired" : "pending";
  if (order.status === "rejected" && !order.approval) return "expired";
  return "decided";
}

/** The reason first: "€116.00 over the €1,500.00 per-order limit." */
export function phoneReason(order: Order): string {
  const [first] = asks(order);
  return first ? askSentence(first) : "A person must decide this order.";
}

/** "4:32" left on the offer, or undefined once it has run out. */
export function timeLeft(expiresAt: string, nowMs: number): string | undefined {
  const left = Date.parse(expiresAt) - nowMs;
  if (!(left > 0)) return undefined;
  const seconds = Math.floor(left / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The log entry that records the person's decision on this order. */
export function decisionEntry(audit: AuditEntry[], orderId: string): AuditEntry | undefined {
  return [...audit].reverse().find((entry) => entry.refs.orderId === orderId && (entry.event === "approval.granted" || entry.event === "approval.rejected"));
}
