import type { BasketQuantity, OfferLine, Quantity } from "@/lib/contracts";
import { count } from "@/lib/offers/format";

/** A kitchen's pieces are the wholesaler's sales units. */
export function toQuantity(quantity: BasketQuantity): Quantity {
  return { amount: quantity.amount, unit: quantity.unit === "pcs" ? "sales_unit" : quantity.unit };
}

/** "1,000 l", "36 kg", "12 pcs". */
export function quantityLabel(quantity: BasketQuantity): string {
  return `${count(quantity.amount)} ${quantity.unit}`;
}

/** Sold by weight: the quantity is already in kilograms. */
const BY_WEIGHT = "KG";

function lineText(line: Pick<OfferLine, "quantity" | "salesUnit" | "content">): string {
  const { quantity, content } = line;
  if (!content) return `${count(quantity)} packs`;
  if (line.salesUnit === BY_WEIGHT) return `${count(content.amount)} ${content.unit}`;
  const each = Math.round((content.amount / quantity) * 1000) / 1000;
  return `${count(quantity)} x ${count(each)} ${content.unit} = ${count(content.amount)} ${content.unit}`;
}

/** What an offer delivers in the buyer's unit: "1,000 x 1 l = 1,000 l", or "51 x 1 l = 51 l + 149 x 1 l = 149 l" for a split. */
export function packsText(lines: Pick<OfferLine, "quantity" | "salesUnit" | "content">[]): string {
  return lines.filter((line) => line.quantity > 0).map(lineText).join(" + ");
}
