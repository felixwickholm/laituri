import type { UpstreamAvailability, UpstreamPrice } from "./types";
import type { RawProductAvailability, RawProductPrice } from "./raw";

/** Amounts at or above this mean the wholesaler does not track a limit (seen: 999999 and 9999999999). */
const UNTRACKED_AMOUNT = 999_999;

/** "2026-11-15T17:00:00+0200" -> "2026-11-15T17:00:00+02:00", so every Date parser accepts it. */
export function isoOffset(value: string): string {
  return value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

function comparisonUnit(unit: string | null | undefined): "l" | "kg" | undefined {
  const u = unit?.toUpperCase();
  if (u === "L" || u === "LTR") return "l";
  if (u === "KG" || u === "KGM") return "kg";
  return undefined;
}

/** taxRate is a percentage, as the wholesaler reports it (for example 13.5). */
export function normalisePrice(raw: RawProductPrice): UpstreamPrice {
  const catalog = raw.catalogPrice;
  if (raw.error || !catalog) {
    return { productId: raw.productId, found: false, contractPrice: false };
  }
  const per = comparisonUnit(raw.comparisonUnit);
  return {
    productId: raw.productId,
    found: true,
    net: catalog.value,
    gross: catalog.valueWithTax ?? raw.priceWithTax?.value,
    taxRate: raw.tax?.taxRate,
    comparison: raw.comparisonPrice && per ? { amount: raw.comparisonPrice.value, per } : undefined,
    listNet: raw.listPrice?.value,
    contractPrice: raw.netPriceFound,
    validTo: catalog.validTo ? isoOffset(catalog.validTo) : undefined,
  };
}

export function normaliseAvailability(raw: RawProductAvailability): UpstreamAvailability {
  const line = raw.scheduleLines.find((l) => l.availableAmount > 0);
  const model = raw.logisticModel === "Stock" || raw.logisticModel === "Terminal" ? raw.logisticModel : undefined;
  const amount = line?.availableAmount ?? 0;
  return {
    productId: raw.productId,
    deliverable: line !== undefined,
    salesBlock: raw.salesBlock || (line?.salesBlock ?? false),
    logisticModel: model,
    available: amount >= UNTRACKED_AMOUNT ? Infinity : amount,
    availableDate: line?.availableDate ?? undefined,
    orderBy: line && raw.closingTime ? isoOffset(raw.closingTime) : undefined,
    salesUnit: line?.salesUnit ?? raw.scheduleLines[0]?.salesUnit,
  };
}
