import { RuleId, type Order } from "@/lib/contracts";
import { eur, parseEur } from "@/lib/console/format/money";
import { overBy, shortName } from "@/lib/console/format/rules";
import { buildRuns } from "@/lib/console/runs";
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
  /** The agent has Valio Aimo's signed offer for the milk: the price is on screen. */
  milkQuoted: boolean;
  milkTotal?: string;
  milkRulesPassed?: number;
  overLimit?: Order;
  overBy?: string;
  limit?: string;
  shortStock?: Order;
  /** "51 of 200" units of the product the agent first asked for. */
  shortAvailable?: number;
  shortRequested?: number;
  /** Why the product asked for fell short, as the signed offer says it, when it does not read "Only N of M". */
  shortReason?: string;
  /** The agent's attempts to break the rules in this story so far, and how many of them were refused. */
  attempts: number;
  refused: number;
  brokenAt?: number;
}

const FALLBACK_APPROVER = "Maria Lind";
/** Every rule a mandate can hold; an order states its own checks once it exists. */
const RULES_TOTAL = RuleId.options.length;
const SHORT = /Only (\d[\d,]*) of (\d[\d,]*)/i;
/** The attempts shown before the log is edited: the mandate's own rules and the approval key. */
export const RULE_ATTEMPTS = 4;

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
  const activity = live(snapshot.activity);
  const quote = activity.find((item) => item.tool === "request_quote" && item.status === "ok");
  const quoted = parseEur(quote?.detail);
  // The newest block of attempts is this story's: the demo was reset when the tour started.
  const attempts = buildRuns(activity, orders).find((run) => run.kind === "attempts")?.attempts ?? [];
  const facts: StoryFacts = {
    approver: name,
    approverFirst: name.split(" ")[0],
    rulesTotal: RULES_TOTAL,
    milk,
    milkQuoted: quote !== undefined || milk !== undefined,
    overLimit,
    shortStock,
    attempts: attempts.length,
    refused: attempts.filter((attempt) => attempt.stopped === true).length,
  };
  if (quoted !== undefined) facts.milkTotal = eur(quoted);

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
  const reason = shortStock?.offer.lines.find((line) => line.substituteFor)?.substituteFor?.reason;
  const short = reason?.match(SHORT);
  if (short) {
    facts.shortAvailable = number(short[1]);
    facts.shortRequested = number(short[2]);
  } else if (reason) {
    facts.shortReason = reason;
  }
  if (snapshot.chain.state === "broken") facts.brokenAt = snapshot.chain.brokenAt;
  return facts;
}

/** The conditions a step waits for, each a plain question about the live console. */
export type ConditionId = "milkConfirmed" | "milkShown" | "overLimitWaiting" | "overLimitDecided" | "shortStockDone" | "rulesRefused" | "logBroken" | "now";

export const CONDITIONS: Record<ConditionId, (snapshot: ConsoleSnapshot, facts: StoryFacts) => boolean> = {
  milkConfirmed: (_, facts) => facts.milk?.status === "confirmed",
  /** The confirmed order and its passed rules are on screen once the run has ended. */
  milkShown: (snapshot, facts) => facts.milk?.status === "confirmed" && snapshot.run?.status !== "running",
  overLimitWaiting: (_, facts) => facts.overLimit !== undefined,
  overLimitDecided: (_, facts) => facts.overLimit !== undefined && facts.overLimit.status !== "pending_approval",
  shortStockDone: (snapshot, facts) => facts.shortStock !== undefined && snapshot.run?.status !== "running",
  rulesRefused: (_, facts) => facts.refused >= RULE_ATTEMPTS,
  logBroken: (snapshot) => snapshot.chain.state === "broken",
  now: () => true,
};
