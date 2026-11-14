import type { OfferLine, Quantity } from "@/lib/contracts";
import { PACK_CONTENT } from "./packs";

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const ordered = (lines: OfferLine[]) => lines.filter((line) => line.quantity > 0);
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Total litres, kilos or sales units across the ordered lines, from the eval's own pack facts: units ordered times
 * what one unit holds. Undefined when a line is a product the eval has no pack fact for, or one in another unit.
 */
export function coveredAmount(lines: OfferLine[], unit: Quantity["unit"]): number | undefined {
  let total = 0;
  for (const line of ordered(lines)) {
    const pack = PACK_CONTENT[line.productId];
    if (unit === "sales_unit") total += line.quantity;
    else if (pack?.unit === unit) total += line.quantity * pack.amount;
    else return undefined;
  }
  return round(total);
}

/** "1000 x 464306" for each ordered line, as the order states it. */
export function lineText(lines: OfferLine[]): string {
  return ordered(lines)
    .map((line) => `${line.quantity} x ${line.productId}`)
    .join(" + ");
}
