import type { Offer, OfferLine } from "@/lib/contracts";
import { count } from "./money";

/** The parts of an offer line that say how much it holds. */
export type PackLine = Pick<OfferLine, "quantity" | "salesUnit" | "content">;
type StockLine = Pick<OfferLine, "availability">;

/**
 * Sales units that hold several consumer packs or pieces. Their name names the piece ("ciabatta 58g"), not the
 * outer pack, so a bare count would read as pieces. Every other unit is one pack whose name gives its size.
 */
const OUTER: Record<string, [one: string, many: string]> = {
  KI: ["case", "cases"],
  CS: ["case", "cases"],
  KRS: ["crate", "crates"],
  SK: ["sack", "sacks"],
  BAG: ["bag", "bags"],
  PAL: ["pallet", "pallets"],
};

/** Sold by weight: the quantity is already in kilograms. */
const BY_WEIGHT = "KG";

function amount(content: NonNullable<PackLine["content"]>): string {
  return `${count(content.amount)} ${content.unit}`;
}

function outer(line: PackLine): string | undefined {
  const noun = OUTER[line.salesUnit];
  return noun ? noun[line.quantity === 1 ? 0 : 1] : undefined;
}

/** Total net content of the line in the buyer's unit: "13.92 kg". */
export function contentText(line: PackLine): string | undefined {
  return line.content ? amount(line.content) : undefined;
}

/** Net content of one sales unit: "4.64 kg". */
export function eachText(line: PackLine): string | undefined {
  if (!line.content || line.quantity <= 0) return undefined;
  return amount({ amount: Math.round((line.content.amount / line.quantity) * 1000) / 1000, unit: line.content.unit });
}

/** What one unit price buys: "per case" for an outer pack, "each" for a single pack, "per kg" when sold by weight. */
export function priceUnit(line: Pick<PackLine, "salesUnit">): string {
  if (line.salesUnit === BY_WEIGHT) return "per kg";
  const noun = OUTER[line.salesUnit];
  return noun ? `per ${noun[0]}` : "each";
}

/** The pack count alone: "3 cases", "×1,000", "12 kg". */
export function packCount(line: PackLine): string {
  if (line.salesUnit === BY_WEIGHT && line.content) return amount(line.content);
  const noun = outer(line);
  return noun ? `${count(line.quantity)} ${noun}` : `×${count(line.quantity)}`;
}

/** What the packs come to: "3 × 4.64 kg = 13.92 kg" for cases, "1,000 l" for single packs, nothing when sold by weight. */
export function packContent(line: PackLine): string | undefined {
  if (line.salesUnit === BY_WEIGHT) return undefined;
  const total = contentText(line);
  const each = eachText(line);
  if (outer(line) && total && each) return `${count(line.quantity)} × ${each} = ${total}`;
  return total;
}

/**
 * One line in a sentence, packs first and then what they come to in litres or kilograms:
 * "3 cases of Dafgårds ciabatta 58g = 13.92 kg", "1,000 × Valio Eila 1 l = 1,000 l", "12 kg of tomatoes".
 */
export function packText(line: PackLine, name: string): string {
  const total = contentText(line);
  if (line.salesUnit === BY_WEIGHT && total) return `${total} of ${name}`;
  const noun = outer(line);
  const packs = noun ? `${count(line.quantity)} ${noun} of ${name}` : `${count(line.quantity)} × ${name}`;
  return total ? `${packs} = ${total}` : packs;
}

/**
 * Stock as the wholesaler signed it, only where it matters: "stock not tracked" when no count stands behind the
 * line, "only 51 in stock" when the count falls short. Nothing for a line in stock or an offer signed without the field.
 */
export function stockText(line: StockLine): string | undefined {
  const { stock, status, available } = line.availability;
  if (stock === "untracked") return "stock not tracked";
  if (status === "partial" && available !== undefined) return `only ${count(available)} in stock`;
  return undefined;
}

function amountOf(text: string | undefined): number | undefined {
  const match = text?.match(/(\d[\d,]*(?:\.\d+)?)\s*(l|kg)\b/);
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}

/**
 * Says so in words when whole packs come to more than was asked:
 * "Asked 10 kg. Whole cases only: 3 cases = 13.92 kg." Built from the quantity the wholesaler compared in the
 * signed offer and the one line that delivers; undefined when the amounts match or cannot be compared.
 */
export function roundingNote(offer: Pick<Offer, "lines" | "requestCheck">): string | undefined {
  const check = offer.requestCheck?.find((item) => item.requirement === "quantity");
  const lines = offer.lines.filter((line) => line.quantity > 0);
  if (!check || lines.length !== 1) return undefined;
  const [line] = lines;
  const asked = amountOf(check.asked);
  const total = contentText(line);
  const delivered = line.content?.amount;
  if (asked === undefined || delivered === undefined || !total || delivered <= asked + 1e-9) return undefined;
  const noun = OUTER[line.salesUnit];
  const packs = noun ? `${count(line.quantity)} ${noun[line.quantity === 1 ? 0 : 1]} = ${total}` : packContent(line) ?? total;
  return `Asked ${check.asked.trim().replace(/(\d) (l|kg|units)\b/g, "$1\u00a0$2")}. Whole ${noun ? noun[1] : "packs"} only: ${packs}.`;
}
