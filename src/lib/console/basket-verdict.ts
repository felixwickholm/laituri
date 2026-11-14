import type { Basket } from "@/lib/contracts";
import { lineCounts } from "./basket";
import { count } from "./format/money";
import { helsinkiDate, weekStart } from "./format/week";

/** ISO week number of an instant, Helsinki time: 14 Nov 2026 is week 46. */
export function isoWeek(ms: number): number {
  const monday = new Date(`${weekStart(ms)}T12:00:00Z`);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const firstJan = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - firstJan) / 86_400_000 / 7) + 1;
}

/** This week's weekly order: the newest one created since Monday, running or done. A shop order never takes its place. */
export function weeklyBasket(baskets: Basket[], nowMs: number): Basket | undefined {
  const monday = weekStart(nowMs);
  return [...baskets]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .find((basket) => basket.source === "weekly" && helsinkiDate(Date.parse(basket.createdAt)).date >= monday);
}

export type VerdictKind = "working" | "needs" | "blocked" | "done";

export interface BasketVerdict {
  kind: VerdictKind;
  /** The biggest words on the card. */
  headline: string;
  /** Lines a person can still act on: orange and red, not yet resolved. */
  open: number;
}

function lines(n: number): string {
  return n === 1 ? "1 line" : `${count(n)} lines`;
}

/** The card's one headline, most urgent first: still working, then needs you, then blocked, then all done. */
export function basketVerdictOf(basket: Pick<Basket, "lines" | "status">): BasketVerdict {
  const n = lineCounts(basket);
  const openOrange = basket.lines.filter((line) => line.state === "orange" && !line.resolved).length;
  const openRed = basket.lines.filter((line) => line.state === "red" && !line.resolved).length;
  const open = openOrange + openRed;
  if (basket.status === "running" || n.working > 0) {
    const done = basket.lines.length - n.working;
    return { kind: "working", headline: `Ordering ${count(done)} of ${count(basket.lines.length)}…`, open };
  }
  if (openOrange > 0) return { kind: "needs", headline: `${lines(openOrange)} ${openOrange === 1 ? "needs" : "need"} you.`, open };
  if (openRed > 0) return { kind: "blocked", headline: `${lines(openRed)} ${openRed === 1 ? "is" : "are"} blocked.`, open };
  return { kind: "done", headline: n.green === basket.lines.length ? `All ${count(n.green)} ordered.` : `${count(n.green)} ordered.`, open };
}

/** One line: the headline, or for Valio Aimo's own proposal the thing it proposes ("Gingerbread oat drink for Christmas coffee."). */
export function ideaText(suggestion: { kind: string; headline: string; sentence: string }): string {
  if (suggestion.kind !== "seasonal") return suggestion.headline;
  const rest = suggestion.sentence.replace(/^Valio Aimo suggests\s+/i, "");
  return rest ? `${rest[0].toUpperCase()}${rest.slice(1)}` : suggestion.headline;
}
