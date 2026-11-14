import type { RawMeasure, RawProduct, RawUnitConversion } from "./raw-product";

export interface Content {
  amount: number;
  unit: "l" | "kg";
}

const VOLUME_TO_LITRES: Record<string, number> = { LTR: 1, MLT: 0.001, CLT: 0.01 };
const WEIGHT_TO_KG: Record<string, number> = { KGM: 1, GRM: 0.001 };
const NAME_UNITS: Record<string, Content> = {
  l: { amount: 1, unit: "l" },
  dl: { amount: 0.1, unit: "l" },
  cl: { amount: 0.01, unit: "l" },
  ml: { amount: 0.001, unit: "l" },
  kg: { amount: 1, unit: "kg" },
  g: { amount: 0.001, unit: "kg" },
};
/** No single sales unit in a foodservice catalog holds a tonne; such values are grams or millilitres mislabelled. */
const IMPLAUSIBLE = 1000;

function round(amount: number): number {
  return Math.round(amount * 10_000) / 10_000;
}

function measure(m: RawMeasure | undefined, table: Record<string, number>, unit: Content["unit"]): Content | undefined {
  const factor = m ? table[m.unit] : undefined;
  if (!m || factor === undefined || !(m.value > 0)) return undefined;
  const amount = m.value * factor;
  return { amount: amount >= IMPLAUSIBLE ? amount / 1000 : amount, unit };
}

/** Volume wins for liquids; some records put the net weight in the volume field, so accept weight there too. */
function fromConversion(conv: RawUnitConversion | undefined): Content | undefined {
  if (!conv) return undefined;
  return (
    measure(conv.volume, VOLUME_TO_LITRES, "l") ??
    measure(conv.volume, WEIGHT_TO_KG, "kg") ??
    measure(conv.netWeight, WEIGHT_TO_KG, "kg")
  );
}

/** Base units per sales unit, for example 20 when the sales unit is a case of 20 pieces. */
export function baseUnitsPerSalesUnit(raw: RawProduct): number {
  if (raw.salesUnit === raw.baseUnit) return 1;
  return raw.units.find((u) => u.unitId === raw.salesUnit)?.sizeInBaseUnits ?? 1;
}

const UNIT = String.raw`(kg|g|l|dl|cl|ml)\b`;
const NUM = String.raw`(\d+(?:\.\d+)?)`;
const PAIR = new RegExp(String.raw`${NUM}\s*(?:(kg|g|l|dl|cl|ml)\s*)?/\s*${NUM}\s*${UNIT}`, "i");
const MULTI = new RegExp(String.raw`(\d+)\s*[x×]\s*${NUM}\s*${UNIT}`, "i");
const SINGLE = new RegExp(String.raw`(?:^|[^\d.])${NUM}\s*${UNIT}`, "i");
const LEADING_COUNT = /^\s*(\d+)\s*[x×]\s*\D/i;

function sized(amount: string, unit: string): Content {
  const base = NAME_UNITS[unit.toLowerCase()];
  return { amount: Number(amount) * base.amount, unit: base.unit };
}

/**
 * Two sizes joined by a slash. The second wins for gross/drained weight ("2.5/1.8kg"), piece/pack
 * ("130 g/ 5.2 kg", "60 g x 20 / 1.2 kg") and weight/volume of scoopable products ("508g/0.9L").
 * The first wins for pack/piece ("5kg/33g") and powder/yield ("5kg/333L").
 */
function pairContent(match: RegExpExecArray): Content {
  const second = sized(match[3], match[4]);
  if (!match[2]) return second;
  const first = sized(match[1], match[2]);
  const ratio = second.amount / first.amount;
  if (first.unit === second.unit) return ratio >= 0.3 ? second : first;
  if (first.unit === "kg" && ratio <= 10) return second;
  return first;
}

/** Reads sizes such as "10x1L", "100x2 cl", "20 x Snack 135g", "3kg/20L" or "Milk 1 l". `total` is true when a count is part of the name. */
export function parseNameContent(name: string): { content: Content; total: boolean } | undefined {
  const text = name.replace(/(\d),(\d)/g, "$1.$2");
  const leading = Number(LEADING_COUNT.exec(text)?.[1] ?? 1);
  const pair = PAIR.exec(text);
  if (pair) {
    const c = pairContent(pair);
    return { content: { amount: c.amount * leading, unit: c.unit }, total: leading > 1 };
  }
  const multi = MULTI.exec(text);
  if (multi) {
    const c = sized(multi[2], multi[3]);
    return { content: { amount: Number(multi[1]) * c.amount * leading, unit: c.unit }, total: true };
  }
  const single = SINGLE.exec(text);
  if (!single) return undefined;
  const c = sized(single[1], single[2]);
  return { content: { amount: c.amount * leading, unit: c.unit }, total: leading > 1 };
}

/** Net litres or kilograms in one sales unit: product data first, the product name as fallback. */
export function contentOf(raw: RawProduct, name: string, allowNameParse: boolean): Content | undefined {
  if (raw.salesUnit === "KG") return { amount: 1, unit: "kg" };
  const conv = raw.synkkaData.unitConversions?.[0];
  const perSalesUnit = conv?.synkkaPackagingType === "CASE" ? 1 : baseUnitsPerSalesUnit(raw);
  const fromData = fromConversion(conv);
  const parsed = allowNameParse ? parseNameContent(name) : undefined;
  const fromName = parsed && {
    amount: parsed.content.amount * (parsed.total ? 1 : baseUnitsPerSalesUnit(raw)),
    unit: parsed.content.unit,
  };
  // Drinks and ice cream are often weighed in the data but sold by volume; the name then states litres.
  const preferName = fromName && (!fromData || (fromData.unit === "kg" && fromName.unit === "l") || PAIR.test(name.replace(/(\d),(\d)/g, "$1.$2")));
  const chosen = preferName ? fromName : fromData && { amount: fromData.amount * perSalesUnit, unit: fromData.unit };
  return chosen ? { amount: round(chosen.amount), unit: chosen.unit } : undefined;
}
