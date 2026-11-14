import type { SearchHit } from "@/lib/contracts";
import type { CreateBasketRequest } from "@/lib/contracts";
import { count } from "@/lib/console/format/money";
import { SIZE } from "@/lib/console/format/product";
import { day } from "@/lib/console/format/time";

/** One cart line: what the person chose, with the live figures it was added at. Packs are sales units. */
export interface CartLine {
  productId: string;
  name: string;
  pack: string;
  salesUnit: string;
  packs: number;
  /** Order quantity step, in sales units. */
  step: number;
  unitPrice?: number;
  content?: { amount: number; unit: "l" | "kg" };
  deliveryDate?: string;
  /** The search hit's picture and category, for the cart's thumbnail. */
  image?: string;
  group?: string;
}

export type Cart = CartLine[];

/** A cart line for a search hit, at the first allowed quantity. */
export function lineFor(hit: SearchHit, name: string, pack: string): CartLine {
  const { product, offerPreview } = hit;
  const step = Math.max(1, product.lotSize);
  return {
    productId: product.id,
    name,
    pack,
    salesUnit: product.salesUnit,
    packs: step,
    step,
    unitPrice: offerPreview?.unitPrice.amount,
    content: product.content,
    deliveryDate: offerPreview?.availability.deliveryDate,
    image: hit.image,
    group: product.categoryGroup,
  };
}

/** Adds a line, or more packs to the line already there. */
export function addLine(cart: Cart, line: CartLine): Cart {
  const found = cart.find((item) => item.productId === line.productId);
  if (!found) return [...cart, line];
  return cart.map((item) => (item.productId === line.productId ? { ...item, packs: item.packs + line.packs } : item));
}

/** Sets a line's packs, rounded up to its step. Zero or less takes the line out. */
export function setPacks(cart: Cart, productId: string, packs: number): Cart {
  return cart.flatMap((item) => {
    if (item.productId !== productId) return [item];
    if (packs <= 0) return [];
    return [{ ...item, packs: Math.ceil(packs / item.step) * item.step }];
  });
}

export function packsOf(cart: Cart, productId: string): number {
  return cart.find((item) => item.productId === productId)?.packs ?? 0;
}

/** Net estimate from the live prices the lines were added at. Lines without a price are left out. */
export function cartEstimate(cart: Cart): number {
  return Math.round(cart.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.packs, 0) * 100) / 100;
}

/** The one delivery day the basket asks for: the latest day any line can arrive. */
export function cartDeliveryDay(cart: Cart): string | undefined {
  return cart.map((item) => item.deliveryDate).filter((date): date is string => Boolean(date)).sort().at(-1);
}

/** The line's amount in the kitchen's unit: "12 l", "4.64 kg", "6 pcs". */
export function lineAmount(line: CartLine): { amount: number; unit: "l" | "kg" | "pcs" } {
  if (line.content) return { amount: Math.round(line.packs * line.content.amount * 1000) / 1000, unit: line.content.unit };
  return { amount: line.packs, unit: "pcs" };
}

export function lineAmountText(line: CartLine): string {
  const { amount, unit } = lineAmount(line);
  return `${count(amount)} ${unit}`;
}

/** A pack size with its multiplier, anywhere in a name: "500 g", "4x5 kg", "12300 g". */
const PACK_SIZE = new RegExp(`(\\d+\\s?[x×]\\s?)?${SIZE.source}`, "gi");

/**
 * The words a line is checked against: the product's name without its pack size, which the request check would read
 * as the amount asked for ("500 g" of butter, when the line asks for 5 kg). The product code says which product it is.
 */
export function lineWords(name: string): string {
  const words = name.replace(PACK_SIZE, " ").replace(/…/g, " ").replace(/\s+/g, " ").replace(/[\s,.-]+$/, "").trim();
  return words || name;
}

/** The cart as a person's basket: the same request an agent sends, so the same checks run. */
export function toBasketRequest(cart: Cart, deliverBy: string): CreateBasketRequest {
  return {
    title: `Shop order for ${day(deliverBy).replace(" ", " ")}`,
    deliverBy,
    source: "manual",
    lines: cart.map((line) => ({ words: lineWords(line.name), quantity: lineAmount(line), productId: line.productId })),
  };
}

function isLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.productId === "string" &&
    typeof line.name === "string" &&
    typeof line.pack === "string" &&
    typeof line.salesUnit === "string" &&
    typeof line.packs === "number" &&
    line.packs > 0 &&
    typeof line.step === "number" &&
    line.step > 0
  );
}

/** Reads a stored cart; anything malformed is dropped rather than trusted. */
export function parseCart(text: string | null): Cart {
  if (!text) return [];
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? value.filter(isLine) : [];
  } catch {
    return [];
  }
}
