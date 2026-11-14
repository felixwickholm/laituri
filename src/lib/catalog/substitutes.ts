import type { Product } from "@/lib/contracts";
import { productFat } from "./lexicon";
import type { Entry } from "./rank";

/** Claims a substitute must keep so it still fits the buyer's diet. */
const DIETARY = new Set(["lactose_free", "low_lactose", "gluten_free", "wheat_free", "egg_free", "soy_free", "vegan"]);

function closeness(original: Entry, candidate: Entry): number {
  const a = original.product;
  const b = candidate.product;
  let score = 0;
  if (a.content && b.content && a.content.unit === b.content.unit) {
    if (Math.abs(a.content.amount - b.content.amount) < 1e-6) score += 3;
    else score += 1 - Math.min(1, Math.abs(Math.log(a.content.amount / b.content.amount)));
  }
  const fat = productFat(original.text);
  if (fat && productFat(candidate.text) === fat) score += 2;
  if (a.brand && a.brand === b.brand) score += 1;
  if (a.salesUnit === b.salesUnit) score += 0.5;
  return score + 0.5 * (b.deliveryReliability ?? 0.9);
}

/** Wholesaler-listed substitutes first, then products of the same concept that keep every dietary claim. */
export function substitutesFor(byId: Map<string, Entry>, all: Entry[], id: string, limit = 10): Product[] {
  const original = byId.get(id);
  if (!original) return [];
  const listed = original.product.substitutes
    .map((sid) => byId.get(sid)?.product)
    .filter((p): p is Product => p !== undefined && p.id !== id);
  const required = original.product.claims.filter((c) => DIETARY.has(c));
  const seen = new Set([id, ...listed.map((p) => p.id)]);
  const sameKind = (e: Entry) =>
    original.product.concept ? e.product.concept === original.product.concept : e.product.category === original.product.category;
  const similar = all
    .filter((e) => !seen.has(e.product.id) && sameKind(e) && required.every((c) => e.product.claims.includes(c)))
    .map((e) => ({ product: e.product, score: closeness(original, e) }))
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
    .map((s) => s.product);
  return [...listed, ...similar].slice(0, limit);
}
