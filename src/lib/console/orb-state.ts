import type { Order } from "@/lib/contracts";
import { RULE_NAMES, askReasons, blockedLine, shortName } from "./format/rules";
import { eur } from "./format/money";
import { plainSentence } from "./format/sentence";
import { day } from "./format/time";
import type { OrbState } from "./orb-params";
import { buildRuns } from "./runs";
import type { ConsoleSnapshot } from "./types";

export interface OrbView {
  state: OrbState;
  caption: string;
  digits: string;
  rulesPassed: number;
  rulesTotal: number;
}

/** How long a just-confirmed or just-blocked order holds the orb before it settles. */
export const RECENT_MS = 4000;
/** A tool call this recent shows as acting; after that the agent is thinking again. */
export const ACTING_MS = 1500;
export const RULES_TOTAL = Object.keys(RULE_NAMES).length;
export const IDLE_CAPTION = "Idle. Watching your mandate.";

function newest(orders: Order[]): Order | undefined {
  return [...orders].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).pop();
}

function isRecent(iso: string, nowMs: number): boolean {
  const at = Date.parse(iso);
  return !Number.isNaN(at) && nowMs - at >= 0 && nowMs - at < RECENT_MS;
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

function approverName(snapshot: ConsoleSnapshot): string {
  const name = snapshot.mandate?.mandate.approval.approver.name;
  return name ? shortName(name) : "a person";
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
    if (attempt) return plainSentence(attempt.stopped === undefined ? attempt.action : `Stopped. ${attempt.reason ?? ""}`.trim());
  }
  const step = run.steps[run.steps.length - 1];
  return step ? plainSentence(step.text) : "Starting…";
}

/**
 * Maps the console snapshot to what the orb shows. Precedence: an order that just ended (signed or blocked),
 * then a running purchase, then an order waiting for a person, then idle.
 */
export function orbStateFor(snapshot: ConsoleSnapshot, nowMs: number): OrbView {
  const latest = newest(snapshot.orders);
  const digits = latest ? orderDigits(latest) : hexOf(auditHead(snapshot));

  if (latest && isRecent(latest.updatedAt, nowMs)) {
    if (latest.status === "confirmed") return { state: "signed", caption: confirmedCaption(latest), digits, ...rules(latest) };
    if (latest.status === "blocked") return { state: "blocked", caption: blockedLine(latest), digits, ...rules(latest) };
  }

  if (snapshot.run?.status === "running") {
    const last = snapshot.activity[snapshot.activity.length - 1];
    const acting = last?.kind === "tool" && nowMs - Date.parse(last.at) < ACTING_MS;
    return { state: acting ? "acting" : "thinking", caption: runningCaption(snapshot), digits, rulesPassed: 0, rulesTotal: RULES_TOTAL };
  }

  const waiting = [...snapshot.orders].filter((order) => order.status === "pending_approval").sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
  if (waiting) {
    const [reason] = askReasons(waiting);
    return {
      state: "approval",
      caption: `Waiting for ${approverName(snapshot)}. ${reason ?? "The order needs a person's OK."}`,
      digits: orderDigits(waiting),
      ...rules(waiting),
    };
  }

  if (latest) return { state: "idle", caption: IDLE_CAPTION, digits, ...rules(latest) };
  return { state: "idle", caption: IDLE_CAPTION, digits, rulesPassed: RULES_TOTAL, rulesTotal: RULES_TOTAL };
}
