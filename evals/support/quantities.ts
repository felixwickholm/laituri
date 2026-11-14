import type { OfferLine, Quantity } from "@/lib/contracts";
import { catalog } from "@/lib/catalog";

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const ordered = (lines: OfferLine[]) => lines.filter((line) => line.quantity > 0);
const round = (value: number) => Math.round(value * 1000) / 1000;

/** Total litres, kilos or sales units across the ordered lines; undefined when a line has no such content. */
export function coveredAmount(lines: OfferLine[], unit: Quantity["unit"]): number | undefined {
  let total = 0;
  for (const line of ordered(lines)) {
    if (unit === "sales_unit") total += line.quantity;
    else if (line.content?.unit === unit) total += line.content.amount;
    else return undefined;
  }
  return round(total);
}

/** The largest single lot among the ordered lines, in the unit of the need: the most an order may run over. */
export function lotExcessLimit(lines: OfferLine[], unit: Quantity["unit"]): number {
  let largest = 0;
  for (const line of ordered(lines)) {
    const lot = catalog().get(line.productId)?.lotSize ?? 1;
    const perUnit = unit === "sales_unit" ? 1 : (line.content?.amount ?? 0) / line.quantity;
    largest = Math.max(largest, perUnit * lot);
  }
  return largest;
}

/** "1000 x 464306 (1000 l)" for each ordered line. */
export function lineText(lines: OfferLine[]): string {
  return ordered(lines)
    .map((line) => `${line.quantity} x ${line.productId}${line.content ? ` (${round(line.content.amount)} ${line.content.unit})` : ""}`)
    .join(" + ");
}
