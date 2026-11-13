import type { Check, RuleId } from "@/lib/contracts";

/** Whole cents, so limits compare exactly. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

const eurFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 101000 -> "1,010.00 EUR" */
export function eur(cents: number): string {
  return `${eurFormat.format(cents / 100)} EUR`;
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Helsinki",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Buyer-local time, for example "14 Nov, 09:15". */
export function localTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function listText(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function check(rule: RuleId, status: Check["status"], message: string, extra: Pick<Check, "observed" | "limit"> = {}): Check {
  return { rule, status, message, ...extra };
}
