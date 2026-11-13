import type { Order } from "@/lib/contracts";
import { toCents } from "./format";

const BUYER_TIME_ZONE = "Europe/Helsinki";

export interface IsoWeek {
  year: number;
  week: number;
}

/** ISO 8601 week of the calendar date at the buyer's location. */
export function isoWeek(at: Date, timeZone = BUYER_TIME_ZONE): IsoWeek {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const weekday = date.getUTCDay() || 7;
  // The Thursday of this week decides which year the week belongs to.
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

/** For example "2026-W46". */
export function isoWeekKey(at: Date): string {
  const { year, week } = isoWeek(at);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function sameIsoWeek(a: Date, b: Date): boolean {
  return isoWeekKey(a) === isoWeekKey(b);
}

/** Net spend of confirmed orders placed in the ISO week of `at`, in EUR. */
export function confirmedNetInWeek(orders: Order[], at: Date): number {
  const cents = orders
    .filter((order) => order.status === "confirmed" && sameIsoWeek(new Date(order.createdAt), at))
    .reduce((sum, order) => sum + toCents(order.offer.totals.net.amount), 0);
  return cents / 100;
}
