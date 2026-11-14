import type { OfferLine, Product } from "@/lib/contracts";
import { count, productName } from "./format";
import { buildLine, isOnTime } from "./lines";
import { contentPerUnit, round, unitsFor, type UnitContent } from "./packs";
import type { BuiltLine, Market } from "./types";

/** Same concept, keeps every claim of the original, and adds no allergen the original did not contain. */
export function isLikeForLike(original: Product, candidate: Product): boolean {
  if (!original.concept || original.concept !== candidate.concept) return false;
  if (!original.claims.every((claim) => candidate.claims.includes(claim))) return false;
  return candidate.allergens.contains.every((allergen) => original.allergens.contains.includes(allergen));
}

/** Net price per litre or kilogram, from the comparison price or derived from the unit price. */
function comparisonPrice(product: Product, market: Market): number | undefined {
  const price = market.prices.get(product.id);
  if (!price?.found) return undefined;
  if (price.comparison && price.comparison.amount > 0) return price.comparison.amount;
  const content = contentPerUnit(product, price);
  return price.net !== undefined && content ? price.net / content.amount : undefined;
}

export function priceChangePct(original: Product, candidate: Product, market: Market): number {
  const before = comparisonPrice(original, market);
  const after = comparisonPrice(candidate, market);
  if (!before || after === undefined) return 0;
  return round(((after - before) / before) * 100, 1);
}

/** Why the original line needs help, as one plain sentence. */
export function shortfallReason(line: OfferLine): string {
  const { status, requested, available } = line.availability;
  switch (status) {
    case "partial":
      return `Only ${count(available)} of ${count(requested)} units of ${line.name} are in stock.`;
    case "cutoff_passed":
      return `The order cut-off for ${line.name} has passed.`;
    case "blocked":
      return `${line.name} is blocked from sale.`;
    case "unavailable":
      return `${line.name} is not available.`;
    default:
      return `${line.name} arrives after the requested date.`;
  }
}

/**
 * A substitute line covering the given content, or undefined when the candidate
 * cannot be converted or cannot deliver all of it on time.
 */
export function substituteLine(
  original: Product,
  originalLine: OfferLine,
  candidate: Product,
  need: UnitContent,
  market: Market,
): BuiltLine | undefined {
  const content = contentPerUnit(candidate, market.prices.get(candidate.id));
  const units = need.amount > 0 ? unitsFor({ amount: need.amount, unit: need.unit }, content, candidate.lotSize) : undefined;
  if (units === undefined) return undefined;
  const built = buildLine(candidate.id, candidate, units, market);
  if (!isOnTime(built.line, market.deliverBy)) return undefined;
  built.line.substituteFor = {
    productId: original.id,
    name: productName(original),
    reason: shortfallReason(originalLine),
    likeForLike: isLikeForLike(original, candidate),
    priceChangePct: priceChangePct(original, candidate, market),
  };
  built.notes.push(`${built.line.name} replaces ${productName(original)}.`);
  return built;
}
