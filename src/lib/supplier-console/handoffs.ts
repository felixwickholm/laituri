import type { Basket, BasketLine, Handoff } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { plural } from "./format";

/** Open questions first, newest first within each group. */
export function sortHandoffs(handoffs: Handoff[]): Handoff[] {
  return [...handoffs].sort((a, b) => (a.status === b.status ? b.at.localeCompare(a.at) : a.status === "open" ? -1 : 1));
}

/** The page's one line: how many questions wait for a person. */
export function handoffsHeadline(handoffs: Handoff[]): string {
  const open = handoffs.filter((handoff) => handoff.status === "open").length;
  if (handoffs.length === 0) return "No customer has asked for a person yet.";
  if (open === 0) return "Every question has an answer.";
  return `${plural(open, "question waits", "questions wait")} for an answer.`;
}

export interface ContextRow {
  label: string;
  value: string;
}

function lineOf(handoff: Handoff, baskets: Basket[]): { basket?: Basket; line?: BasketLine } {
  const basket = handoff.context.basketId ? baskets.find((item) => item.id === handoff.context.basketId) : undefined;
  const line = basket && handoff.context.lineId ? basket.lines.find((item) => item.id === handoff.context.lineId) : undefined;
  return { basket, line };
}

/**
 * What the system attached to a question, so the operator does not have to ask again: the line, why it stopped,
 * and the amounts. Without a basket line the context's own sentence stands alone.
 */
export function handoffContext(handoff: Handoff, baskets: Basket[]): ContextRow[] {
  const { basket, line } = lineOf(handoff, baskets);
  const rows: ContextRow[] = [{ label: "About", value: handoff.context.summary }];
  if (basket) rows.push({ label: "Order", value: `${basket.title} · ${plural(basket.totals.lines, "line")}` });
  if (line) {
    rows.push({ label: "Line", value: `${line.words} · ${count(line.asked.amount)} ${line.asked.unit}` });
    rows.push({ label: "Why it stopped", value: line.reason });
    if (line.product) rows.push({ label: "Product", value: line.product.name });
    if (line.net !== undefined) rows.push({ label: "Amount", value: `${eur(line.net)} net` });
  }
  if (handoff.context.orderId && !line) rows.push({ label: "Order number", value: handoff.context.orderId });
  return rows;
}

/** Out of hours, what the kitchen was told while it waits. */
export function toldKitchen(handoff: Handoff): string | undefined {
  return handoff.openHours.open ? undefined : handoff.openHours.sentence;
}
