import type { OfferLine, Quantity } from "@/lib/contracts";

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

/** "the 5 l case", from the line's pack content and sales unit. */
export function packName(line: OfferLine, packContent?: { amount: number; unit: string }): string {
  const noun = PACK_NOUN[line.salesUnit] ?? "pack";
  return packContent ? `the ${amount(packContent.amount)} ${packContent.unit} ${noun}` : `the ${noun} ${line.name}`;
}

/** "Maria Lind, Head of Purchasing" -> "Maria Lind". */
export function personName(name: string): string {
  return name.split(",")[0].trim();
}

/** Why a line cannot be delivered as asked, in one plain sentence about "it". */
export function lineProblem(line: OfferLine, deliverBy: string): string {
  const { status, available, deliveryDate } = line.availability;
  switch (status) {
    case "cutoff_passed":
      return "Its order cut-off passed.";
    case "blocked":
      return "It is blocked from sale.";
    case "unavailable":
      return "It cannot be delivered.";
    case "partial":
      return `Only ${amount(available)} are in stock.`;
    default:
      return deliveryDate && deliveryDate > deliverBy ? "It arrives too late." : "It cannot cover the need.";
  }
}
