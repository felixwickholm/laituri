import type { KitchenAmount, LineAvailability, Order, Product } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import { day } from "@/lib/offers/format";
import { quoteLine } from "@/lib/offers/lines";
import { marketOf } from "@/lib/offers/market";
import { contentPerUnit } from "@/lib/offers/packs";
import type { Market } from "@/lib/offers/types";
import type { ProductWords } from "@/lib/recipes";
import type { UpstreamClient } from "@/lib/valio/types";
import { allowedByNeverBuy } from "@/lib/policy/never-buy";
import { missingClaims, productSafe, type DietRules } from "./dietary";

const SEARCH_LIMIT = 20;

/** The allergens a product may contain for these words: those the ingredient declares, milk sugar counted with milk. */
function declaredBy(spec: ProductWords): Set<string> {
  return new Set([...spec.allergens, ...(spec.allergens.includes("milk") ? ["lactose"] : [])]);
}

/**
 * Products the words find that carry the claims, have the name words, contain nothing the ingredient does not declare
 * (so a dish's allergens stay true whatever product is bought), meet the allergen rules and are not on the buyer's
 * never-buy list, in search order.
 */
export function candidatesFor(spec: ProductWords, catalog: Pick<Catalog, "search">, rules: DietRules): Product[] {
  const { hits } = catalog.search({ query: spec.words, filters: spec.claims ? { claims: spec.claims } : undefined, limit: SEARCH_LIMIT });
  const declared = declaredBy(spec);
  return hits
    .map((hit) => hit.product)
    .filter((product) => (spec.nameHas ?? []).every((part) => product.name.en.toLowerCase().includes(part)))
    .filter((product) => product.allergens.contains.every((allergen) => declared.has(allergen)))
    .filter((product) => productSafe(product.allergens, rules))
    .filter((product) => allowedByNeverBuy({ dietary: { neverBuy: rules.neverBuy } }, product));
}

/** One price call and one availability call for every product a plan may use, as a quote would see them. */
export async function marketFor(
  ids: string[],
  deliverBy: string,
  deps: { upstream: UpstreamClient; customerNumber: string; orders: Order[]; now: Date },
): Promise<Market> {
  const unique = [...new Set(ids)];
  const [prices, availability] = await Promise.all([
    deps.upstream.price(unique, deliverBy, deps.customerNumber),
    deps.upstream.availability(unique, deliverBy, deps.customerNumber),
  ]);
  return marketOf(prices, availability, deps.orders, deps.now, deliverBy);
}

/** Indicative net EUR per litre or kilogram, when the wholesaler has a price and the content is known. */
export function pricePerUnit(product: Product, market: Market): number | undefined {
  const price = market.prices.get(product.id);
  const content = contentPerUnit(product, price);
  if (!price?.found || price.net === undefined || !content) return undefined;
  return price.net / content.amount;
}

export interface Picked {
  product: Product;
  availability: LineAvailability;
  /** Net EUR for the whole need, in whole packs; absent when the wholesaler has no price. */
  estNet?: number;
  /** The product is outside the agent's category groups: a person approves it. */
  outside: boolean;
  /** Why it is not ok, in one plain sentence. */
  problem?: string;
  /** The order cut-off for the delivery date. */
  orderBy?: string;
  /** The kitchen's required labels this product does not carry: the policy blocks the order on them. */
  missingClaims?: string[];
}

function assess(product: Product, need: KitchenAmount, market: Market, rules: DietRules, words: string): Picked {
  const { line } = quoteLine(product.id, product, need, market);
  const { status, deliveryDate, orderBy } = line.availability;
  const late = deliveryDate !== undefined && deliveryDate > market.deliverBy;
  const priced = market.prices.get(product.id)?.found === true && line.availability.requested > 0;
  const base = {
    product,
    estNet: priced ? Math.round(line.availability.requested * line.unitPrice.amount * 100) / 100 : undefined,
    outside: !rules.allowedCategories.includes(product.categoryGroup),
    orderBy,
    ...(rules.requiredClaims.length && missingClaims(product, rules.requiredClaims).length ? { missingClaims: missingClaims(product, rules.requiredClaims) } : {}),
  };
  if (status === "available" && !late) return { ...base, availability: "ok" };
  if (status === "available") return { ...base, availability: "missing", problem: `${capital(words)} ${verb(words, "arrives", "arrive")} ${day(deliveryDate!)}, too late.` };
  if (status === "partial") return { ...base, availability: "short", problem: `Only part of the ${words} is in stock.` };
  if (status === "cutoff_passed") return { ...base, availability: "missing", problem: `The order cut-off for ${words} has passed.` };
  return { ...base, availability: "missing", problem: `${capital(words)} cannot be delivered for ${day(market.deliverBy)}.` };
}

const RANK: Record<LineAvailability, number> = { ok: 0, short: 1, missing: 2 };

/**
 * The best product for a need: one with the kitchen's required labels first (the policy blocks any other), then in
 * time and in full, then inside the agent's categories, then the lowest net.
 */
export function pickProduct(candidates: Product[], need: KitchenAmount, market: Market, rules: DietRules, words: string): Picked | undefined {
  const lacking = (picked: Picked) => Number(Boolean(picked.missingClaims));
  return candidates
    .map((product) => assess(product, need, market, rules, words))
    .sort(
      (a, b) =>
        lacking(a) - lacking(b) ||
        RANK[a.availability] - RANK[b.availability] ||
        Number(a.outside) - Number(b.outside) ||
        (a.estNet ?? Infinity) - (b.estNet ?? Infinity),
    )[0];
}

/** "Carrots arrive", "Cream arrives": plural words end in s. */
export function verb(words: string, one: string, many: string): string {
  return /[^s]s$/.test(words) ? many : one;
}

export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
