import type { Check, Order, RuleId } from "@/lib/contracts";
import { eur, parseEur } from "./money";
import { plainSentence } from "./sentence";

/** Each policy rule in plain words, as a buyer would name it. */
export const RULE_NAMES: Record<RuleId, string> = {
  "mandate.signature": "Mandate signature",
  "mandate.validity": "Mandate validity",
  "offer.signature": "Offer signature",
  "offer.expiry": "Offer validity",
  "audit.integrity": "Audit log intact",
  "spend.per_order": "Per-order limit",
  "spend.per_week": "Weekly limit",
  "category.allowed": "Allowed categories",
  "dietary.allergens": "Never-buy allergens",
  "dietary.claims": "Required product claims",
  "substitution.policy": "Substitution policy",
  "substitution.price": "Substitute price change",
  "delivery.partial": "Partial delivery",
  "delivery.deadline": "Delivery deadline",
  "match.confidence": "Product match",
  "request.words": "Buyer's words sent",
  "product.first_time": "First-time products",
};

export function ruleName(rule: RuleId | string): string {
  return RULE_NAMES[rule as RuleId] ?? rule;
}

/** How far an amount is over its limit, in whole cents so €1,616.00 − €1,500.00 is exactly €116.00. */
export function overBy(amount: number, limit: number): number {
  return Math.max(0, Math.round(amount * 100) - Math.round(limit * 100)) / 100;
}

/** One plain sentence for a check that asks a person. */
export function askSentence(check: Check): string {
  const observed = parseEur(check.observed);
  const limit = parseEur(check.limit);
  if (check.rule === "spend.per_order" && observed !== undefined && limit !== undefined) {
    return `${eur(overBy(observed, limit))} over the ${eur(limit)} per-order limit.`;
  }
  if (check.rule === "spend.per_week" && observed !== undefined && limit !== undefined) {
    return `${eur(overBy(observed, limit))} over the ${eur(limit)} weekly limit.`;
  }
  return plainSentence(check.message);
}

/** The allergen ids a block names, as words: "brazil_nut, nuts" -> "brazil nut and nuts". */
function words(list: string | undefined): string {
  const items = (list ?? "").split(",").map((item) => item.trim().replace(/_/g, " ")).filter(Boolean);
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** One plain sentence for a check that blocks the order. */
export function blockSentence(check: Check): string {
  if (check.rule === "dietary.allergens" && check.observed && /contains/.test(check.message)) {
    const what = words(check.observed);
    const verb = /may contain/.test(check.message) ? "May contain" : "Contains";
    return `${verb} ${what}. The mandate forbids ${what}.`;
  }
  return plainSentence(check.message);
}

export function asks(order: Order): Check[] {
  return order.decision.checks.filter((check) => check.status === "ask");
}

export function blocks(order: Order): Check[] {
  return order.decision.checks.filter((check) => check.status === "block");
}

/** The reasons a pending order waits for a person, one sentence each. */
export function askReasons(order: Order): string[] {
  return asks(order).map(askSentence);
}

/** "Blocked. Contains nuts. The mandate forbids nuts.", or for an order refused before the mandate ran, "Refused. <why>". */
export function blockedLine(order: Order): string {
  if (order.refusal) return `Refused. ${plainSentence(order.refusal.message.replace(/^Refused:?\s*/i, ""))}`;
  const [first] = blocks(order);
  return first ? `Blocked. ${blockSentence(first)}` : "Blocked. The order is outside the mandate.";
}

export type HandledState = "auto" | "approved" | "rejected" | "blocked" | "expired";

export function handledState(order: Order): HandledState {
  if (order.status === "blocked") return "blocked";
  if (order.status === "rejected") return order.approval ? "rejected" : "expired";
  return order.approval ? "approved" : "auto";
}

export const HANDLED_WORD: Record<HandledState, string> = {
  auto: "Auto-approved",
  approved: "Approved",
  rejected: "Rejected",
  blocked: "Blocked",
  expired: "Expired",
};

/** "Maria Lind, Head of Purchasing" -> "Maria Lind" */
export function shortName(name: string): string {
  return name.split(",")[0].trim();
}

export interface RuleTick {
  rule: string;
  name: string;
  status: Check["status"];
}

/** The order's mandate checks as a checklist: how many passed, of how many, and each rule by name in the order checked. */
export function ruleChecklist(order: Pick<Order, "decision">): { passed: number; total: number; rules: RuleTick[] } {
  const rules = order.decision.checks.map((check) => ({ rule: check.rule, name: ruleName(check.rule), status: check.status }));
  return { passed: rules.filter((rule) => rule.status === "pass").length, total: rules.length, rules };
}
