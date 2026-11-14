const EUR = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" });
const NUMBER = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** 1812 -> "€1,812.00" */
export function eur(amount: number): string {
  return EUR.format(amount);
}

/** 1000 -> "1,000"; 2.5 -> "2.5" */
export function count(value: number): string {
  return NUMBER.format(value);
}

const SERVER_EUR = /(-?\d[\d,]*(?:\.\d+)?)\s?EUR\b/g;

/** Reads the server's "1,812.00 EUR" form back into a number. */
export function parseEur(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(-?\d[\d,]*(?:\.\d+)?)\s?EUR\b/);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

/** Rewrites every "1,812.00 EUR" in a server sentence as "€1,812.00". */
export function withEuroSign(text: string): string {
  return text.replace(SERVER_EUR, (_, value: string) => eur(Number(value.replace(/,/g, ""))));
}

/** Share of a limit used, as a whole percentage, clamped to 0..999. */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(999, Math.max(0, Math.round((part / whole) * 100)));
}
