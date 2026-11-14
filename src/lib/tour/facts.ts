import type { Order } from "@/lib/contracts";
import { eur, parseEur } from "@/lib/console/format/money";
import { shortProductName } from "@/lib/console/format/product";
import { overBy, shortName } from "@/lib/console/format/rules";
import type { ConsoleSnapshot } from "@/lib/console/types";

/**
 * The facts the walkthrough's sentences quote, read from the live console. The demo is reset when the tour
 * starts, so every order and activity without the seeded mark belongs to the story being told.
 */
export interface StoryFacts {
  /** "Maria", for "Maria's rules". */
  approverFirst: string;
  /** "Maria Lind" */
  approver: string;
  rulesTotal: number;
  milk?: Order;
  milkTotal?: string;
  milkRulesPassed?: number;
  overLimit?: Order;
  overBy?: string;
  limit?: string;
  shortStock?: Order;
  /** "51 of 200" units of the product the agent first asked for. */
  shortAvailable?: number;
  shortRequested?: number;
  brokenAt?: number;
}

const FALLBACK_APPROVER = "Maria Lind";
const RULES_TOTAL = 15;
const SHORT = /Only (\d[\d,]*) of (\d[\d,]*)/i;

function live<T extends object>(records: T[]): T[] {
  return records.filter((record) => (record as { seeded?: unknown }).seeded !== true);
}

function byCreated(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function perOrderCheck(order: Order) {
  return order.decision.checks.find((check) => check.rule === "spend.per_order");
}

function substituted(order: Order): boolean {
  return order.offer.lines.some((line) => line.substituteFor);
}

function isOverLimit(order: Order): boolean {
  return perOrderCheck(order)?.status === "ask";
}

function number(text: string): number {
  return Number(text.replace(/,/g, ""));
}

export function storyFacts(snapshot: ConsoleSnapshot): StoryFacts {
  const name = shortName(snapshot.mandate?.mandate.approval.approver.name ?? FALLBACK_APPROVER);
  const orders = byCreated(live(snapshot.orders));
  const milk = orders.find((order) => !substituted(order) && !isOverLimit(order));
  const overLimit = orders.find(isOverLimit);
  const shortStock = orders.find(substituted);
  const facts: StoryFacts = { approver: name, approverFirst: name.split(" ")[0], rulesTotal: RULES_TOTAL, milk, overLimit, shortStock };

  if (milk) {
    facts.milkTotal = eur(milk.offer.totals.net.amount);
    facts.milkRulesPassed = milk.decision.checks.filter((check) => check.status === "pass").length;
    facts.rulesTotal = Math.max(milk.decision.checks.length, facts.milkRulesPassed);
  }
  const check = overLimit ? perOrderCheck(overLimit) : undefined;
  const observed = parseEur(check?.observed);
  const limit = parseEur(check?.limit);
  if (observed !== undefined && limit !== undefined) {
    facts.overBy = eur(overBy(observed, limit));
    facts.limit = eur(limit);
  }
  const reason = shortStock?.offer.lines.find((line) => line.substituteFor)?.substituteFor?.reason.match(SHORT);
  if (reason) {
    facts.shortAvailable = number(reason[1]);
    facts.shortRequested = number(reason[2]);
  }
  if (snapshot.chain.state === "broken") facts.brokenAt = snapshot.chain.brokenAt;
  return facts;
}

/** The product the agent took instead, in short words. */
export function takenInstead(order: Order | undefined): string | undefined {
  const line = order?.offer.lines.find((item) => item.substituteFor);
  return line ? shortProductName(line.name) : undefined;
}

/** The conditions a step waits for, each a plain question about the live console. */
export type ConditionId = "agentWorking" | "milkConfirmed" | "milkShown" | "overLimitWaiting" | "overLimitDecided" | "shortStockDone" | "logBroken" | "now";

export const CONDITIONS: Record<ConditionId, (snapshot: ConsoleSnapshot, facts: StoryFacts) => boolean> = {
  /** The request reached the agent and its first steps are on screen. */
  agentWorking: (snapshot) => live(snapshot.activity).length >= 2,
  milkConfirmed: (_, facts) => facts.milk?.status === "confirmed",
  /** The confirmed order and its passed rules are what the orb shows. */
  milkShown: (snapshot, facts) => facts.milk?.status === "confirmed" && snapshot.run?.status !== "running",
  overLimitWaiting: (_, facts) => facts.overLimit !== undefined,
  overLimitDecided: (_, facts) => facts.overLimit !== undefined && facts.overLimit.status !== "pending_approval",
  shortStockDone: (snapshot, facts) => facts.shortStock !== undefined && snapshot.run?.status !== "running",
  logBroken: (snapshot) => snapshot.chain.state === "broken",
  now: () => true,
};
