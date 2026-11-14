import type { Basket, BasketLine, LineState } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";
import { plural } from "./format";

/** "Weekly order · 20 lines · 17 ordered, 2 need the customer, 1 blocked": a basket as one event. */
export function basketSentence(basket: Basket): string {
  const { lines, green, orange, red, working } = basket.totals;
  const parts = [
    green > 0 ? `${green} ordered` : undefined,
    orange > 0 ? `${orange} ${orange === 1 ? "needs" : "need"} the customer` : undefined,
    red > 0 ? `${red} blocked` : undefined,
    working > 0 ? `${working} in progress` : undefined,
  ].filter(Boolean);
  return [basket.title, plural(lines, "line"), parts.join(", ")].filter(Boolean).join(" · ");
}

export const LINE_WORD: Record<LineState, string> = {
  green: "Ordered",
  orange: "Needs the customer",
  red: "Blocked",
  working: "Working",
};

/** The line's state as the shared tone of a state pill. */
export function lineTone(state: LineState): "success" | "waiting" | "danger" | "neutral" {
  return state === "green" ? "success" : state === "orange" ? "waiting" : state === "red" ? "danger" : "neutral";
}

/** Lines that need a person or were blocked come first, so a long weekly order opens on what matters. */
export function linesByAttention(lines: BasketLine[]): BasketLine[] {
  const rank: Record<LineState, number> = { red: 0, orange: 1, working: 2, green: 3 };
  return [...lines].sort((a, b) => rank[a.state] - rank[b.state]);
}

export type FeedItem = { kind: "call"; at: string; call: Activity } | { kind: "basket"; at: string; basket: Basket };

/** The time span a basket's agent worked in: from its start to the newest call that touched one of its offers or orders. */
function basketSpan(basket: Basket, calls: Activity[]): { from: string; to: string } {
  const refs = new Set(basket.lines.flatMap((line) => [line.orderId, line.offerId].filter((id): id is string => Boolean(id))));
  let to = basket.createdAt;
  for (const call of calls) {
    const touched = (call.refs?.orderId && refs.has(call.refs.orderId)) || (call.refs?.offerId && refs.has(call.refs.offerId));
    if (touched && call.at > to) to = call.at;
  }
  return { from: basket.createdAt, to: basket.status === "running" ? "￿" : to };
}

/**
 * The live feed with each basket folded into one event: a basket's searches, quotes and orders (the same buyer's
 * calls inside the basket's working span) give way to a single row, placed at the basket's newest call.
 */
export function foldBaskets(calls: Activity[], baskets: Basket[]): FeedItem[] {
  const folded = new Set<string>();
  const events: FeedItem[] = [];
  for (const basket of baskets) {
    const span = basketSpan(basket, calls);
    let newest = basket.createdAt;
    for (const call of calls) {
      if (call.buyer?.id !== basket.buyer.id || call.at < span.from || call.at > span.to) continue;
      folded.add(call.id);
      if (call.at > newest) newest = call.at;
    }
    events.push({ kind: "basket", at: newest, basket });
  }
  const rest: FeedItem[] = calls.filter((call) => !folded.has(call.id)).map((call) => ({ kind: "call", at: call.at, call }));
  return [...events, ...rest].sort((a, b) => b.at.localeCompare(a.at));
}
