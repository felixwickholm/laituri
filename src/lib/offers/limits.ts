import type { OfferLine, QuoteRequest, QuantityUnit } from "@/lib/contracts";
import { helsinkiDate } from "@/lib/agent/dates";
import { GatewayError } from "@/lib/gateway/errors";
import { count } from "./format";

/** The most one order line may ask for, per unit, before the request is treated as a mistake. */
export type LineCeiling = Record<QuantityUnit, number>;

export const DEFAULT_LINE_CEILING = 20_000;
const CEILING_ENV: Record<QuantityUnit, string> = {
  l: "LAITURI_MAX_LINE_LITRES",
  kg: "LAITURI_MAX_LINE_KG",
  sales_unit: "LAITURI_MAX_LINE_UNITS",
};
const UNIT_TEXT: Record<QuantityUnit, string> = { l: "l", kg: "kg", sales_unit: "sales units" };
/** Above a quarter of the ceiling, a line on untracked stock is large enough that a person should vouch for it. */
export const UNTRACKED_REVIEW_SHARE = 0.25;

export class ImplausibleQuantityError extends GatewayError {
  constructor(message: string) {
    super(message, 422, "quantity_implausible");
  }
}

export class PastDeliveryDateError extends GatewayError {
  constructor(message: string) {
    super(message, 422, "delivery_date_past");
  }
}

function ceilingFor(unit: QuantityUnit): number {
  const configured = Number(process.env[CEILING_ENV[unit]]);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LINE_CEILING;
}

export function lineCeiling(): LineCeiling {
  return { l: ceilingFor("l"), kg: ceilingFor("kg"), sales_unit: ceilingFor("sales_unit") };
}

function quantityText(amount: number, unit: QuantityUnit): string {
  return `${count(amount)} ${UNIT_TEXT[unit]}`;
}

/** Refuses a request no single order could mean: a quantity over the line ceiling, or a delivery date already gone. */
export function checkQuoteLimits(request: QuoteRequest, now: Date, nameOf: (productId: string) => string): void {
  const today = helsinkiDate(now);
  if (request.deliverBy < today) {
    throw new PastDeliveryDateError(`The delivery date ${request.deliverBy} is in the past: today is ${today}. Ask for today or a later date.`);
  }
  const ceiling = lineCeiling();
  for (const { productId, quantity } of request.lines) {
    const max = ceiling[quantity.unit];
    if (quantity.amount <= max) continue;
    throw new ImplausibleQuantityError(
      `${quantityText(quantity.amount, quantity.unit)} of ${nameOf(productId)} is more than one order line can hold: at most ${quantityText(max, quantity.unit)}. ` +
        "Ask for a realistic quantity, or split a real need over several orders.",
    );
  }
}

/** The quantity of a line on untracked stock that is too large to confirm without a person, if it is. */
export function untrackedOverReview(line: OfferLine): string | undefined {
  if (line.availability.stock !== "untracked") return undefined;
  const ceiling = lineCeiling();
  const content = line.content;
  if (content && content.amount > ceiling[content.unit] * UNTRACKED_REVIEW_SHARE) return quantityText(content.amount, content.unit);
  if (line.quantity > ceiling.sales_unit * UNTRACKED_REVIEW_SHARE) return quantityText(line.quantity, "sales_unit");
  return undefined;
}
