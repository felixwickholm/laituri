const ZONE = "Europe/Helsinki";

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const HOUR_MINUTE = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

const DAY_AND_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Mon 16 Nov" with the day and month held together, so a line never breaks between them. */
function joinDayMonth(text: string): string {
  return text.replace(/(\d+) ([A-Z][a-z]{2})$/, "$1\u00a0$2");
}

function valid(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

/** "09:14:03", Helsinki time. */
export function clock(iso: string): string {
  const date = new Date(iso);
  return valid(date) ? CLOCK.format(date) : "–";
}

/** "09:14", Helsinki time. */
export function hourMinute(iso: string | undefined): string {
  if (!iso) return "–";
  const date = new Date(iso);
  return valid(date) ? HOUR_MINUTE.format(date) : "–";
}

/** "2026-11-16" -> "Mon 16 Nov". A full timestamp is read in Helsinki time. */
export function day(value: string | undefined): string {
  if (!value) return "–";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return valid(date) ? joinDayMonth(DAY.format(date).replace(",", "")) : "–";
  }
  const date = new Date(value);
  return valid(date) ? dayOf(date) : "–";
}

function dayOf(date: Date): string {
  const parts = DAY_AND_TIME.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("weekday")} ${pick("day")}\u00a0${pick("month")}`;
}

/** "Mon 16 Nov, 09:14" */
export function dayAndTime(iso: string): string {
  const date = new Date(iso);
  return valid(date) ? `${dayOf(date)}, ${HOUR_MINUTE.format(date)}` : "–";
}

/** Short age for inbox rows: "now", "4m", "2h", "3d". */
export function age(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "–";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const LONG_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "long", day: "numeric", month: "long" });

/** "Saturday 14 November", Helsinki time. */
export function longDay(ms: number): string {
  const date = new Date(ms);
  return valid(date) ? LONG_DAY.format(date).replace(",", "") : "–";
}

/** How long something took: "under 1 s", "6 s", "1 min 4 s", "2 h 5 min". */
export function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return "under 1 s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}\u00a0s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes}\u00a0min ${seconds % 60}\u00a0s` : `${minutes}\u00a0min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours}\u00a0h ${minutes % 60}\u00a0min` : `${hours}\u00a0h`;
}
