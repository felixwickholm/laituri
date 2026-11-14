import type { Offer, Product } from "@/lib/contracts";

const counter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1000 -> "1,000". */
export function count(value: number): string {
  return counter.format(value);
}

/** 1010 -> "1,010.00 EUR". */
export function eur(amount: number): string {
  return `${money.format(amount)} EUR`;
}

/** Signed percentage phrase used in trade-offs: "4 % more expensive". */
export function priceChangePhrase(pct: number): string {
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) return "about the same price";
  return pct > 0 ? `${rounded} % more expensive` : `${rounded} % cheaper`;
}

function datePart(isoDate: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** "2026-11-16" -> "Monday 16 Nov". */
export function day(isoDate: string): string {
  return datePart(isoDate, { weekday: "long", day: "numeric", month: "short" });
}

/** "2026-11-16" -> "Monday". */
export function weekday(isoDate: string): string {
  return datePart(isoDate, { weekday: "long" });
}

/** Timestamp in Finnish local time: "Thu 12 Nov 12:00". */
export function dateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Helsinki",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("hour")}:${get("minute")}`;
}

/** Local time of day only: "09:15". */
export function clockTime(iso: string): string {
  return dateTime(iso).split(" ").pop() ?? iso;
}

export function productName(product: Product): string {
  return product.name.en || product.name.fi;
}

/** What an offer covers, for one-sentence summaries: "1,000 x Valio Eila 1 l" or "3 lines". */
export function offerSubject(offer: Offer): string {
  const offered = offer.lines.filter((line) => line.quantity > 0);
  const lines = offered.length > 0 ? offered : offer.lines;
  if (lines.length === 1) {
    const [line] = lines;
    return line.quantity > 0 ? `${count(line.quantity)} x ${line.name}` : line.name;
  }
  return `${lines.length} lines`;
}
