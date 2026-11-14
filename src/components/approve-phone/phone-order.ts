import type { AuditEntry, Order, RequestCheck, RequestCheckResult } from "@/lib/contracts";
import { asks, askSentence } from "@/lib/console/format/rules";

export type OrderPhase = "pending" | "expired" | "decided" | "blocked";

/** Until when a person can still approve: the signed price hold when the order carries one, else the offer's expiry. */
export function deadline(order: Order): string {
  return order.priceHold?.heldUntil ?? order.offer.expiresAt;
}

/** Where the order stands for the person holding the phone. A price past its hold or expiry cannot be approved. */
export function orderPhase(order: Order, nowMs: number): OrderPhase {
  if (order.status === "blocked") return "blocked";
  if (order.status === "pending_approval") return Date.parse(deadline(order)) <= nowMs ? "expired" : "pending";
  if (order.status === "rejected" && !order.approval) return "expired";
  return "decided";
}

/** The words before a colon: "not UHT: Valio Arki Eila …" reads "not UHT". */
function headOf(value: string): string {
  const cut = value.indexOf(":");
  return (cut > 0 ? value.slice(0, cut) : value).trim();
}

/**
 * The reason first, in one short sentence. A request that the offer does not meet names the first mismatch
 * ("Asked UHT. Offered not UHT."); otherwise the rule's own sentence ("€116.00 over the €1,500.00 per-order limit.").
 */
export function phoneReason(order: Order): string {
  const miss = (order.offer.requestCheck ?? []).find((check) => check.result === "unmet");
  if (miss) return `Asked ${headOf(miss.asked)}. Offered ${headOf(miss.offered)}.`;
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

const REQUIREMENT: Record<RequestCheck["requirement"], string> = {
  product: "Product",
  claim: "Claim",
  brand: "Brand",
  attribute: "Attribute",
  wording: "Other words",
  quantity: "Quantity",
  date: "Date",
  budget: "Budget",
  approval: "Approval first",
};

const RESULT_WORD: Record<RequestCheckResult, string> = {
  met: "Matches",
  unmet: "Does not match",
  unchecked: "Not checked",
  substituted: "Substitute",
};

export interface PhoneCheck {
  label: string;
  asked: string;
  /** What would be delivered, naming the product as the offer gives it. */
  offered: string;
  result: RequestCheckResult;
  word: string;
  /** For a substitute: the buyer's own substitution rule that allowed it, in one sentence. */
  rule?: string;
}

/** The buyer's substitution rule as it decided this order, from the checks signed on it. */
export function substitutionRule(order: Order): string {
  const policy = order.decision.checks.find((check) => check.rule === "substitution.policy");
  if (policy?.status === "ask") return "Your rules ask a person to approve a substitute that is not like for like.";
  if (policy?.limit === "like_for_like") return "Your rules allow a like-for-like substitute.";
  return "Your rules allow a substitute within your price limit.";
}

/** The wholesaler's comparison of the buyer's words with this offer, one row per requirement, as signed in the offer. */
export function phoneChecks(order: Order): PhoneCheck[] {
  return (order.offer.requestCheck ?? []).map((check) => ({
    label: REQUIREMENT[check.requirement],
    asked: check.asked,
    offered: check.offered,
    result: check.result,
    word: RESULT_WORD[check.result],
    ...(check.result === "substituted" ? { rule: substitutionRule(order) } : {}),
  }));
}
