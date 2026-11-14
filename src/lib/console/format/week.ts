import type { Order } from "@/lib/contracts";

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Helsinki",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Helsinki calendar date and weekday (0 = Monday) of an instant. */
function helsinkiDate(ms: number): { date: string; weekday: number } {
  const parts = PARTS.formatToParts(new Date(ms));
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${pick("year")}-${pick("month")}-${pick("day")}`, weekday: WEEKDAY_INDEX[pick("weekday")] ?? 0 };
}

/** The Monday that starts the ISO week of `ms`, as YYYY-MM-DD in Helsinki. */
export function weekStart(ms: number): string {
  const { date, weekday } = helsinkiDate(ms);
  const monday = new Date(`${date}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - weekday);
  return monday.toISOString().slice(0, 10);
}

/** Net spend of confirmed orders in the ISO week that contains `nowMs`. */
export function weekSpend(orders: Order[], nowMs: number): number {
  const start = weekStart(nowMs);
  const cents = orders
    .filter((order) => order.status === "confirmed")
    .filter((order) => {
      const at = Date.parse(order.createdAt);
      return !Number.isNaN(at) && helsinkiDate(at).date >= start;
    })
    .reduce((sum, order) => sum + Math.round(order.offer.totals.net.amount * 100), 0);
  return cents / 100;
}
