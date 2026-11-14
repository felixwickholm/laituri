import { addDays, helsinkiDate, nextWorkingDay, weekdayOf } from "@/lib/agent/dates";

const ZONE = "Europe/Helsinki";
const MINUTE_MS = 60_000;

/** Orders close at this Helsinki time on the last working day before delivery. */
export const CUTOFF_TIME = "16:00";

function isWorkingDay(date: string): boolean {
  const weekday = weekdayOf(date);
  return weekday !== 0 && weekday !== 6;
}

function previousWorkingDay(date: string): string {
  let day = addDays(date, -1);
  while (!isWorkingDay(day)) day = addDays(day, -1);
  return day;
}

/** Offset of Helsinki from UTC at an instant, in milliseconds. */
function helsinkiOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  return Math.round((local - at.getTime()) / MINUTE_MS) * MINUTE_MS;
}

/** The instant of a Helsinki wall-clock time, for example ("2026-11-12", "08:15"). */
export function helsinkiInstant(date: string, time: string): Date {
  const asUtc = new Date(`${date}T${time}:00Z`);
  return new Date(asUtc.getTime() - helsinkiOffsetMs(asUtc));
}

/** The `count` working days before the day of `now`, most recent first. */
export function workingDaysBefore(now: Date, count: number): string[] {
  const days: string[] = [];
  let day = helsinkiDate(now);
  while (days.length < count) {
    day = previousWorkingDay(day);
    days.push(day);
  }
  return days;
}

/** When orders for a delivery date close. */
export function orderCutoff(deliverBy: string): Date {
  return helsinkiInstant(previousWorkingDay(deliverBy), CUTOFF_TIME);
}

/** A delivery a week after `at`, on the first working day from then, and its order cut-off. */
export function weekAheadSlot(at: Date): { deliverBy: string; orderBy: Date } {
  let deliverBy = addDays(helsinkiDate(at), 7);
  while (!isWorkingDay(deliverBy)) deliverBy = addDays(deliverBy, 1);
  return { deliverBy, orderBy: orderCutoff(deliverBy) };
}

/**
 * The delivery a request at `at` asks for: the next working day, or the first one still open when `missCutoff`
 * is false. With `missCutoff` the buyer asks for the next working day after its cut-off has passed.
 */
export function deliverySlot(at: Date, missCutoff: boolean): { deliverBy: string; orderBy: Date } {
  let deliverBy = nextWorkingDay(helsinkiDate(at));
  if (!missCutoff) {
    while (orderCutoff(deliverBy).getTime() <= at.getTime()) deliverBy = nextWorkingDay(deliverBy);
  }
  return { deliverBy, orderBy: orderCutoff(deliverBy) };
}
