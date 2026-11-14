import type { AvailabilityStatus, OfferLine, Product, Quantity } from "@/lib/contracts";
import { productFacts } from "@/lib/catalog/facts";
import { count, dateTime, day, productName } from "./format";
import { contentPerUnit, lineContent, roundDownToLot, unitsFor } from "./packs";
import type { BuiltLine, Market } from "./types";

interface Assessment {
  status: AvailabilityStatus;
  offered: number;
  note?: string;
}

/** Normalise a tax rate to percent: upstream may send 13.5 or 0.135. */
function taxPercent(rate: number | undefined): number {
  if (rate === undefined) return 0;
  return rate > 1 ? rate : Math.round(rate * 10000) / 100;
}

function assess(productId: string, product: Product | undefined, units: number | undefined, market: Market): Assessment {
  const unavailable = (note: string): Assessment => ({ status: "unavailable", offered: 0, note });
  if (!product) return unavailable(`Product ${productId} is not in the catalogue.`);
  const name = productName(product);
  if (units === undefined) {
    return unavailable(`The pack size of ${name} is unknown, so the quantity cannot be converted to sales units.`);
  }
  const availability = market.availability.get(productId);
  const price = market.prices.get(productId);
  if (!availability || !availability.deliverable) return unavailable(`${name} cannot be delivered.`);
  if (availability.available <= 0) return unavailable(`${name} is out of stock.`);
  if (!price?.found || price.net === undefined) return unavailable(`No price was found for ${name}.`);
  if (availability.salesBlock) return { status: "blocked", offered: 0, note: `${name} is blocked from sale.` };
  if (availability.orderBy && Date.parse(availability.orderBy) < market.now.getTime()) {
    const forDate = availability.availableDate ? ` for ${day(availability.availableDate)}` : "";
    return {
      status: "cutoff_passed",
      offered: 0,
      note: `The order cut-off${forDate} passed on ${dateTime(availability.orderBy)}.`,
    };
  }
  if (availability.available < units) {
    const offered = roundDownToLot(availability.available, product.lotSize);
    const note = `Only ${count(availability.available)} of ${count(units)} units of ${name} are in stock.`;
    return offered > 0 ? { status: "partial", offered, note } : unavailable(note);
  }
  return { status: "available", offered: units };
}

/** Build one offer line for a fixed number of sales units, with honest availability. */
export function buildLine(productId: string, product: Product | undefined, units: number | undefined, market: Market): BuiltLine {
  const price = market.prices.get(productId);
  const availability = market.availability.get(productId);
  const content = contentPerUnit(product, price);
  const { status, offered, note } = assess(productId, product, units, market);
  const unitPrice = price?.found && price.net !== undefined ? price.net : 0;
  const deliveryDate = offered > 0 ? availability?.availableDate : undefined;
  const requested = units ?? 0;
  const available = availability && Number.isFinite(availability.available)
    ? Math.max(0, availability.available)
    : Math.max(requested, offered);

  const line: OfferLine = {
    productId,
    gtin: product?.gtin,
    name: product ? productName(product) : `Unknown product ${productId}`,
    categoryGroup: product?.categoryGroup ?? "unknown",
    quantity: offered,
    salesUnit: product?.salesUnit ?? availability?.salesUnit ?? "ST",
    content: offered > 0 ? lineContent(offered, content) : undefined,
    unitPrice: { amount: unitPrice, currency: "EUR" },
    comparisonPrice: price?.comparison,
    taxRate: taxPercent(price?.taxRate),
    lineNet: { amount: Math.round(offered * unitPrice * 100) / 100, currency: "EUR" },
    availability: {
      status,
      requested,
      available,
      deliveryDate,
      orderBy: availability?.orderBy,
      logisticModel: availability?.logisticModel,
    },
    facts: productFacts(product),
  };
  const notes = note ? [note] : [];
  if (deliveryDate && deliveryDate > market.deliverBy) {
    notes.push(`${line.name} arrives on ${day(deliveryDate)}, after the requested ${day(market.deliverBy)}.`);
  }
  return { line, notes, product };
}

/** Build the line for a quantity as the buyer asked for it (l, kg or sales units). */
export function quoteLine(productId: string, product: Product | undefined, quantity: Quantity, market: Market): BuiltLine {
  const content = contentPerUnit(product, market.prices.get(productId));
  const units = product ? unitsFor(quantity, content, product.lotSize) : unitsFor(quantity, undefined, 1);
  return buildLine(productId, product, units, market);
}

/** Delivered in full and in time. */
export function isOnTime(line: OfferLine, deliverBy: string): boolean {
  const { status, deliveryDate } = line.availability;
  return status === "available" && line.quantity > 0 && (!deliveryDate || deliveryDate <= deliverBy);
}
