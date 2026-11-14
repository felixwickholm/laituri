import { RuleId, type Check, type Order } from "@/lib/contracts";
import { askSentence, asks, blockedLine, overBy } from "./format/rules";
import { eur, parseEur } from "./format/money";
import { stepText } from "./format/run-view";
import { day } from "./format/time";
import type { Basket } from "@/lib/contracts";
import { basketOrderIds, currentBasket, lineCounts, workingCaption } from "./basket";
import type { OrbState } from "./orb-params";
import { buildRuns } from "./runs";
import { agentSuspension } from "./suspension";
import type { ConsoleSnapshot } from "./types";

export interface OrbView {
  state: OrbState;
  caption: string;
  digits: string;
  rulesPassed: number;
  rulesTotal: number;
}

/** How long the orb replays the mandate check of a just-decided order, rule by rule, before it shows the outcome. */
export const CHECK_MS = 1500;
/** How long a just-confirmed or just-blocked order holds the orb after the check, before it settles. */
export const RECENT_MS = 4000;
/** A tool call this recent shows as acting; after that the agent is thinking again. */
export const ACTING_MS = 1500;
/** Every rule of the mandate, as many as the contract names; never a typed number. */
export const RULES_TOTAL = RuleId.options.length;
export const IDLE_CAPTION = `Ready. It checks ${RULES_TOTAL} rules on every order.`;
export const SUSPENDED_CAPTION = "Suspended by Valio Aimo.";

function newest(orders: Order[]): Order | undefined {
  return [...orders].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).pop();
}

/** Milliseconds since the order last changed, or undefined when that was outside the recent window. */
function sinceChange(order: Order, nowMs: number): number | undefined {
  const at = Date.parse(order.updatedAt);
  const since = nowMs - at;
  return !Number.isNaN(at) && since >= 0 && since < CHECK_MS + RECENT_MS ? since : undefined;
}

/** "Checking rule 9 of 17…": the order's own checks, replayed one by one over {@link CHECK_MS}. */
function checking(order: Order, since: number, digits: string): OrbView {
  const checks = order.decision.checks;
  const total = Math.max(checks.length, 1);
  const n = Math.min(total, Math.floor((since / CHECK_MS) * total) + 1);
  const passed = checks.slice(0, n - 1).filter((check) => check.status === "pass").length;
  return { state: "thinking", caption: `Checking rule ${n} of ${total}…`, digits, rulesPassed: passed, rulesTotal: total };
}

/** The first reason a person is asked, short: "€116.00 over the limit", "a product it has not ordered before". */
function shortAsk(check: Check | undefined): string {
  if (!check) return "the order needs a person's OK";
  const observed = parseEur(check.observed);
  const limit = parseEur(check.limit);
  if (check.rule === "spend.per_order" && observed !== undefined && limit !== undefined) return `${eur(overBy(observed, limit))} over the limit`;
  if (check.rule === "spend.per_week" && observed !== undefined && limit !== undefined) return `${eur(overBy(observed, limit))} over the weekly limit`;
  const sentence = askSentence(check).replace(/\.$/, "");
  return sentence ? sentence[0].toLowerCase() + sentence.slice(1) : "the order needs a person's OK";
}

/** The order's own digits: product codes and the net total, so the orb is drawn from the deal. */
export function orderDigits(order: Order): string {
  const codes = order.offer.lines.map((line) => line.productId).join("");
  const total = order.offer.totals.net.amount.toFixed(2).replace(".", "");
  return `${codes}${total}`.replace(/\D/g, "");
}

function rules(order: Order | undefined): { rulesPassed: number; rulesTotal: number } {
  if (!order || order.decision.checks.length === 0) return { rulesPassed: 0, rulesTotal: RULES_TOTAL };
  const passed = order.decision.checks.filter((check) => check.status === "pass").length;
  return { rulesPassed: passed, rulesTotal: Math.max(order.decision.checks.length, passed) };
}

function auditHead(snapshot: ConsoleSnapshot): string {
  if (snapshot.chain.state === "verified" && snapshot.chain.head) return snapshot.chain.head;
  return snapshot.audit[snapshot.audit.length - 1]?.hash ?? "";
}

function hexOf(hash: string): string {
  return hash.replace(/^sha256:/, "").replace(/[^0-9a-f]/gi, "");
}


function confirmedCaption(order: Order): string {
  const { totals, deliveryDate } = order.offer;
  const arrives = deliveryDate ? `, arrives ${day(deliveryDate)}` : "";
  return `Signed and confirmed. ${eur(totals.net.amount)} net${arrives}.`;
}

/** The newest sentence of the running purchase, in the console's plain words. */
function runningCaption(snapshot: ConsoleSnapshot): string {
  const [run] = buildRuns(snapshot.activity, snapshot.orders);
  if (!run) return snapshot.run?.request ? `Asked: ${snapshot.run.request}` : "Starting…";
  if (run.kind === "attempts") {
    const attempt = run.attempts[run.attempts.length - 1];
    if (attempt) return stepText(attempt.stopped === undefined ? attempt.action : `Refused. ${attempt.reason ?? ""}`.trim());
  }
  const step = run.steps[run.steps.length - 1];
  return step ? stepText(step.text) : "Starting…";
}

/** A basket's own digits: its product codes and the net ordered so far. */
function basketDigits(basket: Basket): string {
  const codes = basket.lines.map((line) => line.product?.id ?? "").join("");
  return `${codes}${basket.totals.netOrdered.toFixed(2)}`.replace(/\D/g, "");
}

/** The orb over a basket: the seal fills line by line while the agent works, then takes the basket's colour. */
export function basketOrbView(basket: Basket): OrbView {
  const n = lineCounts(basket);
  const total = Math.max(basket.lines.length, 1);
  const progress = { digits: basketDigits(basket), rulesPassed: total - n.working, rulesTotal: total };
  if (basket.status === "running" || n.working > 0) return { state: "acting", caption: workingCaption(basket), ...progress };
  if (n.orange > 0) return { state: "approval", caption: `${n.orange === 1 ? "1 line needs" : `${n.orange} lines need`} you.`, ...progress };
  const blocked = n.red > 0 ? ` ${n.red === 1 ? "1 is" : `${n.red} are`} blocked.` : "";
  return { state: "signed", caption: `Ordered ${n.green} of ${basket.lines.length} lines.${blocked}`, ...progress };
}

/**
 * Maps the console snapshot to what the orb shows, caption included. Precedence: a suspension by the wholesaler,
 * then a basket the agent is working, then a single order that just changed (its checks replayed, then signed or
 * blocked), then a running request, then an order waiting for a person, then this week's basket, then idle.
 */
export function orbStateFor(snapshot: ConsoleSnapshot, nowMs: number, baskets: Basket[] = []): OrbView {
  const inBaskets = basketOrderIds(baskets);
  const single = snapshot.orders.filter((order) => !inBaskets.has(order.id));
  const latest = newest(single);
  const digits = latest ? orderDigits(latest) : hexOf(auditHead(snapshot));

  if (agentSuspension(snapshot.audit, snapshot.mandate?.mandate.agent.id)) {
    return { state: "blocked", caption: SUSPENDED_CAPTION, digits, rulesPassed: 0, rulesTotal: RULES_TOTAL };
  }

  const basket = currentBasket(baskets, nowMs);
  if (basket?.status === "running") return basketOrbView(basket);

  const since = latest ? sinceChange(latest, nowMs) : undefined;
  if (latest && since !== undefined && latest.status !== "rejected") {
    if (since < CHECK_MS && latest.decision.checks.length > 0) return checking(latest, since, digits);
    if (latest.status === "confirmed") return { state: "signed", caption: confirmedCaption(latest), digits, ...rules(latest) };
    if (latest.status === "blocked") return { state: "blocked", caption: blockedLine(latest), digits, ...rules(latest) };
  }

  if (snapshot.run?.status === "running") {
    const last = snapshot.activity[snapshot.activity.length - 1];
    const acting = last?.kind === "tool" && nowMs - Date.parse(last.at) < ACTING_MS;
    return { state: acting ? "acting" : "thinking", caption: runningCaption(snapshot), digits, rulesPassed: 0, rulesTotal: RULES_TOTAL };
  }

  const waiting = single.filter((order) => order.status === "pending_approval").sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
  if (waiting) {
    return {
      state: "approval",
      caption: `Waiting for the purchasing manager: ${shortAsk(asks(waiting)[0])}.`,
      digits: orderDigits(waiting),
      ...rules(waiting),
    };
  }

  if (basket) return basketOrbView(basket);
  if (latest) return { state: "idle", caption: IDLE_CAPTION, digits, ...rules(latest) };
  return { state: "idle", caption: IDLE_CAPTION, digits, rulesPassed: RULES_TOTAL, rulesTotal: RULES_TOTAL };
}
