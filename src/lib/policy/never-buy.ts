import type { Mandate, NeverBuy, Product } from "@/lib/contracts";

/** The reason every place that skips or blocks a product on the list gives. */
export const NEVER_BUY_REASON = "On your never-buy list.";

const EMPTY: NeverBuy = { products: [], words: [] };

/** A mandate, or anything carrying its never-buy list the way a mandate does. */
export type WithNeverBuy = { dietary: { neverBuy?: Mandate["dietary"]["neverBuy"] } };

/** The buyer's never-buy list; a mandate signed before the list existed has an empty one. */
export function neverBuyOf(mandate: WithNeverBuy): NeverBuy {
  const list = mandate.dietary.neverBuy ?? EMPTY;
  return { products: list.products ?? [], words: list.words ?? [] };
}

export interface NeverBuyHit {
  /** "product": the product itself is listed. "word": one of its names contains a listed word. */
  by: "product" | "word";
  /** The listed product's name, or the listed word. */
  entry: string;
}

type Named = { id: string; name?: Product["name"] | string };

function namesOf(product: Named): string[] {
  if (!product.name) return [];
  if (typeof product.name === "string") return [product.name];
  return [product.name.en, product.name.fi, product.name.sv].filter((name): name is string => Boolean(name));
}

/** Whether the list rules out this product, and by which entry. Words match whole words, case and accents aside. */
export function neverBuyHit(mandate: WithNeverBuy, product: Named): NeverBuyHit | undefined {
  const list = neverBuyOf(mandate);
  const listed = list.products.find((item) => item.productId === product.id);
  if (listed) return { by: "product", entry: listed.name };
  const names = namesOf(product).map(fold);
  const word = list.words.find((w) => {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(fold(w))}($|[^\\p{L}\\p{N}])`, "u");
    return names.some((name) => pattern.test(name));
  });
  return word ? { by: "word", entry: word } : undefined;
}

/** True when the list allows the product: the filter every picker of products applies. */
export function allowedByNeverBuy(mandate: WithNeverBuy, product: Named): boolean {
  return neverBuyHit(mandate, product) === undefined;
}

function fold(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

/** The catalogue's product for an id, for its names in every language; the policy module itself reads no catalogue. */
export type ProductLookup = (productId: string) => Pick<Product, "name"> | undefined;

/**
 * True when no line the offer delivers is on the list: the filter for alternatives and swaps a person is offered. With
 * `products`, each line is judged by the product's names in every language, as the rule judges it, and by its offered name.
 */
export function offerAllowedByNeverBuy(
  mandate: WithNeverBuy,
  offer: { lines: { productId: string; name: string; quantity: number }[] },
  products?: ProductLookup,
): boolean {
  return offer.lines.every((line) => {
    if (line.quantity <= 0) return true;
    const known = products?.(line.productId);
    if (known && !allowedByNeverBuy(mandate, { id: line.productId, name: known.name })) return false;
    return allowedByNeverBuy(mandate, { id: line.productId, name: line.name });
  });
}
