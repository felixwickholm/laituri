import type { AvailabilityStatus, Quantity } from "@/lib/contracts";
import { shortDay } from "./dates";

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const cents = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1146.35 -> "€1,146.35"; 1500 -> "€1,500" when whole is asked for. */
export function euro(amount: number, wholeWhenRound = false): string {
  return wholeWhenRound && Number.isInteger(amount) ? `€${whole.format(amount)}` : `€${cents.format(amount)}`;
}

export function amount(value: number): string {
  return whole.format(value);
}

/** { amount: 1000, unit: "l" } -> "1,000 litres". */
export function quantityText(quantity: Quantity): string {
  const one = quantity.amount === 1;
  const unit = { l: one ? "litre" : "litres", kg: "kg", sales_unit: one ? "unit" : "units" }[quantity.unit];
  return `${amount(quantity.amount)} ${unit}`;
}

export function perUnitWord(unit: Quantity["unit"]): string {
  return { l: "litre", kg: "kg", sales_unit: "unit" }[unit];
}

const PACK_NOUN: Record<string, string> = {
  KI: "case",
  ST: "pack",
  PAK: "pack",
  BAG: "bag",
  BOT: "bottle",
  PRK: "tub",
  RAS: "tin",
  KG: "kilo pack",
};

/** A product name as a buyer would say it, without the "Suomesta" (from Finland) suffix some names carry. */
export function displayName(name: string): string {
  return name.replace(/\s+Suomesta$/i, "").trim();
}

/** "Maria Lind, Head of Purchasing" -> "Maria Lind". */
export function personName(name: string): string {
  return name.split(",")[0].trim();
}

/** One product as the agent sees it: from a search preview or from an offer line. */
export interface Situation {
  name: string;
  salesUnit: string;
  status: AvailabilityStatus;
  available?: number;
  deliveryDate?: string;
  /** Net content of one sales unit. */
  packContent?: { amount: number; unit: string };
}

/** "the 5 l case", from the pack content and sales unit. */
export function packName(item: Situation): string {
  const noun = PACK_NOUN[item.salesUnit] ?? "pack";
  return item.packContent ? `the ${amount(item.packContent.amount)} ${item.packContent.unit} ${noun}` : `the ${noun} ${item.name}`;
}

/** Why a product cannot be used as asked, in one or two plain sentences. */
export function problemNote(item: Situation, deliverBy: string): string {
  const { status, available, deliveryDate } = item;
  if (status === "partial") return `${item.name}: only ${amount(available ?? 0)} in stock.`;
  if (status === "available" && deliveryDate && deliveryDate > deliverBy) {
    return `${item.name} arrives ${shortDay(deliveryDate)}, after ${shortDay(deliverBy)}.`;
  }
  const reason = {
    cutoff_passed: "Its order cut-off passed.",
    blocked: "It is blocked from sale.",
    unavailable: "It cannot be delivered.",
    partial: "",
    available: "It cannot cover the need.",
  }[status];
  return `Skipped ${packName(item)}. ${reason}`;
}
