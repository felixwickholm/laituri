import type { Mandate, Product, Quantity, SignedOffer } from "@/lib/contracts";
import type { AgentTransport } from "@/lib/agent";
import { quantityText } from "@/lib/agent/words";
import { offerOnTime } from "@/lib/agent/choose";
import { allowedByNeverBuy } from "@/lib/policy/never-buy";

export interface SafeSwap {
  product: Product;
  /** The words the swap is quoted with, naming its brand and kind, so the request check compares it with what it is. */
  words: string;
  signed: SignedOffer;
}

/** Passes every "never" rule of the mandate that a product alone decides: never-buy list, allergens, traces, claims, category. */
export function passesNeverRules(product: Product, mandate: Mandate): boolean {
  if (!allowedByNeverBuy(mandate, product)) return false;
  const { excludeAllergens, blockMayContain, requiredClaims } = mandate.dietary;
  if (excludeAllergens.some((allergen) => product.allergens.contains.includes(allergen))) return false;
  if (blockMayContain && excludeAllergens.some((allergen) => product.allergens.mayContain.includes(allergen))) return false;
  if (!requiredClaims.every((claim) => product.claims.includes(claim))) return false;
  return mandate.categories.allowed.includes(product.categoryGroup);
}

/** Claims of the original the candidate keeps; more is closer. */
function keptClaims(original: Product, candidate: Product): number {
  return original.claims.filter((claim) => candidate.claims.includes(claim)).length;
}

/** Candidates of the blocked product's kind for one search, that pass the mandate's product rules and can be ordered. */
async function candidatesFor(query: string, blocked: Product, kind: string, need: Quantity, deliverBy: string, mandate: Mandate, transport: AgentTransport) {
  const { hits } = await transport.searchCatalog({
    query,
    filters: { excludeAllergens: mandate.dietary.excludeAllergens },
    need,
    deliverBy,
    limit: 20,
  });
  return hits
    .filter(({ product }) => product.id !== blocked.id && (product.concept ?? product.categoryGroup) === kind)
    .filter(({ product }) => passesNeverRules(product, mandate))
    .filter(({ offerPreview }) => offerPreview?.orderable !== false)
    .sort((a, b) => keptClaims(blocked, b.product) - keptClaims(blocked, a.product));
}

/**
 * A product of the same kind as one the mandate blocked for an allergen, that passes the mandate's product rules and
 * can be delivered in full on time, signed by the wholesaler. The line's own words are searched first, so "ciabatta
 * rolls" finds other ciabatta rolls before any bread; then the product's kind. Undefined when the catalogue has none.
 */
export async function findSafeSwap(
  blocked: Product,
  need: Quantity,
  deliverBy: string,
  mandate: Mandate,
  transport: AgentTransport,
  words?: string,
): Promise<SafeSwap | undefined> {
  const kind = blocked.concept ?? blocked.categoryGroup;
  const byKind = kind.replaceAll("_", " ");
  const tried = new Set<string>();
  // The line's own words first, among products the wholesaler's preview says arrive in full on time; when none do,
  // any product of the same kind, as before.
  for (const query of words ? [words, byKind] : [byKind]) {
    const own = query === words;
    const candidates = (await candidatesFor(query, blocked, kind, need, deliverBy, mandate, transport)).filter(
      ({ product, offerPreview }) => !tried.has(product.id) && (!own || offerPreview?.orderable === true),
    );
    for (const { product } of candidates.slice(0, 2)) {
      tried.add(product.id);
      // The kind and brand, not the full name: "Alpro Rice drink 1L" would read as rice, and its size as the quantity.
      const swapWords = `${quantityText(need)} of ${product.brand ? `${product.brand} ` : ""}${byKind}`;
      const response = await transport.requestQuote({ lines: [{ productId: product.id, quantity: need }], deliverBy, intent: swapWords, matchConfidence: "high" });
      if (offerOnTime(response.primary.offer)) return { product, words: swapWords, signed: response.primary };
    }
  }
  return undefined;
}
