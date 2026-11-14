import type { Quantity } from "@/lib/contracts";
import { ISSUER } from "@/lib/offers/assemble";
import { shortDay } from "./dates";
import { quantityText } from "./words";

/** The 422 codes with which the wholesaler refuses to quote a request no real order could mean. */
const QUANTITY_IMPLAUSIBLE = "quantity_implausible";
const DELIVERY_DATE_PAST = "delivery_date_past";

function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const { code } = error as { code: unknown };
  return typeof code === "string" ? code : undefined;
}

/**
 * The buyer's sentence for a quote the wholesaler refused, from what the agent understood of the request:
 * "Valio Aimo refused the quote: 1,000,000,000,000 litres is more than one order line can carry."
 * Undefined for any other error. Works for the gateway's errors and the REST transport's alike, both carry the code.
 */
export function quoteRefusal(error: unknown, request: { quantity?: Quantity; deliverBy: string }): string | undefined {
  const code = codeOf(error);
  if (code === QUANTITY_IMPLAUSIBLE) {
    const what = request.quantity ? quantityText(request.quantity) : "the quantity asked for";
    return `${ISSUER} refused the quote: ${what} is more than one order line can carry.`;
  }
  if (code === DELIVERY_DATE_PAST) {
    return `${ISSUER} refused the quote: ${shortDay(request.deliverBy)} has already passed. Ask for today or a later date.`;
  }
  return undefined;
}
