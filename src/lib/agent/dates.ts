const ZONE = "Europe/Helsinki";
const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar date in Helsinki at the given instant, as YYYY-MM-DD. */
export function helsinkiDate(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** The next date strictly after today that falls on the given weekday. */
export function nextWeekday(today: string, weekday: number): string {
  const ahead = ((weekday - weekdayOf(today) + 7) % 7) || 7;
  return addDays(today, ahead);
}

/** The next Monday to Friday after today. */
export function nextWorkingDay(today: string): string {
  let date = addDays(today, 1);
  while (weekdayOf(date) === 0 || weekdayOf(date) === 6) date = addDays(date, 1);
  return date;
}

/** "2026-11-16" -> "Mon 16 Nov". */
export function shortDay(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${isoDate}T12:00:00Z`))
    .replace(",", "");
}

export function isValidDate(isoDate: string): boolean {
  const time = Date.parse(`${isoDate}T12:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === isoDate;
}
