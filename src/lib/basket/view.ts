import { Basket, type BasketLine, type BasketTotals } from "@/lib/contracts";
import type { UpstreamUsage } from "@/lib/valio/meter";
import type { StoredBasket } from "./types";

/**
 * Assumed time a person needs per line by hand: find the product in a webshop, check it and add it to the cart.
 * An assumption stated in the evidence, not a measurement.
 */
export const MINUTES_BY_HAND_PER_LINE = 1;

const cents = (amount: number) => Math.round(amount * 100) / 100;

/** A line a person left out with the skip option: nothing ordered, nothing waiting. */
function leftOut(line: BasketLine): boolean {
  return line.resolved?.optionId.endsWith("-skip") === true;
}

export function basketTotals(lines: BasketLine[], startedAt: string, finishedAt?: string, usage?: UpstreamUsage): BasketTotals {
  const by = (state: BasketLine["state"]) => lines.filter((line) => line.state === state).length;
  const sum = (state: BasketLine["state"]) => cents(lines.filter((line) => line.state === state).reduce((total, line) => total + (line.net ?? 0), 0));
  const seconds = finishedAt ? Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 100) / 10) : undefined;
  return {
    lines: lines.length,
    green: by("green"),
    orange: by("orange"),
    red: by("red"),
    working: by("working"),
    netOrdered: sum("green"),
    netWaiting: sum("orange"),
    ...(seconds !== undefined ? { secondsTaken: seconds } : {}),
    ...(usage ? { upstreamCalls: usage.calls, productsAsked: usage.productsAsked } : {}),
    minutesByHand: lines.length * MINUTES_BY_HAND_PER_LINE,
  };
}

/** "17 of 20 lines ordered. 2 need you. 1 is blocked." */
export function basketSummary(lines: BasketLine[]): string {
  const total = lines.length;
  const working = lines.filter((line) => line.state === "working").length;
  const green = lines.filter((line) => line.state === "green").length;
  const orange = lines.filter((line) => line.state === "orange").length;
  const out = lines.filter(leftOut).length;
  const blocked = lines.filter((line) => line.state === "red" && !leftOut(line)).length;
  const parts = [`${green} of ${total} ${total === 1 ? "line" : "lines"} ordered.`];
  if (working) parts.push(`${working} still working.`);
  if (orange) parts.push(`${orange} ${orange === 1 ? "needs" : "need"} you.`);
  if (blocked) parts.push(`${blocked} ${blocked === 1 ? "is" : "are"} blocked.`);
  if (out) parts.push(`${out} left out.`);
  return parts.join(" ");
}

/**
 * The basket as callers see it. Parsing against the published schema drops what the engine keeps for itself: the
 * signed offers behind the options, the agent and the request as sent.
 */
export function toBasket(stored: StoredBasket): Basket {
  const totals = basketTotals(stored.lines, stored.createdAt, stored.finishedAt, stored.usage);
  return Basket.parse({ ...stored, totals, summary: basketSummary(stored.lines) });
}
