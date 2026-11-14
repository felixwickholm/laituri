import type { Product, Quantity } from "@/lib/contracts";
import type { UpstreamPrice } from "@/lib/valio/types";

export interface UnitContent {
  amount: number;
  unit: "l" | "kg";
}

/** Tolerance for float division, so 1.2 / 0.2 counts as 6 and not 6.000000000000001. */
const EPSILON = 1e-9;

function lotOf(lotSize: number): number {
  return lotSize > 0 ? lotSize : 1;
}

export function roundUpToLot(units: number, lotSize: number): number {
  const lot = lotOf(lotSize);
  return Math.ceil(units / lot - EPSILON) * lot;
}

export function roundDownToLot(units: number, lotSize: number): number {
  const lot = lotOf(lotSize);
  return Math.floor(units / lot + EPSILON) * lot;
}

/** Net content of one sales unit: product data first, else catalogue price divided by comparison price. */
export function contentPerUnit(product: Product | undefined, price?: UpstreamPrice): UnitContent | undefined {
  if (product?.content && product.content.amount > 0) return product.content;
  if (price?.net && price.comparison && price.comparison.amount > 0) {
    return { amount: round(price.net / price.comparison.amount, 3), unit: price.comparison.per };
  }
  return undefined;
}

/**
 * Sales units needed to cover a requested quantity.
 * Litres or kilograms are converted via the unit content and rounded up to the lot size.
 * A quantity in sales units is used as given. Undefined when the content is unknown or in another unit.
 */
export function unitsFor(quantity: Quantity, content: UnitContent | undefined, lotSize: number): number | undefined {
  if (quantity.unit === "sales_unit") return Math.ceil(quantity.amount - EPSILON);
  if (!content || content.unit !== quantity.unit) return undefined;
  return roundUpToLot(Math.ceil(quantity.amount / content.amount - EPSILON), lotSize);
}

/** Total net content the buyer asked for, in l or kg. */
export function requiredContent(quantity: Quantity, content: UnitContent | undefined): UnitContent | undefined {
  if (quantity.unit !== "sales_unit") return { amount: quantity.amount, unit: quantity.unit };
  if (!content) return undefined;
  return { amount: round(quantity.amount * content.amount, 3), unit: content.unit };
}

export function lineContent(units: number, content: UnitContent | undefined): UnitContent | undefined {
  if (!content) return undefined;
  return { amount: round(units * content.amount, 3), unit: content.unit };
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
