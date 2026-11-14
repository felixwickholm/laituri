import type { KitchenAmount, PantryItem, Product, ShoppingLine } from "@/lib/contracts";
import { day } from "@/lib/offers/format";
import type { Market } from "@/lib/offers/types";
import { ROLES, type ProductWords, type RoleId } from "@/lib/recipes";
import type { AdaptedDish } from "./adapt";
import { wordsSafe, type DietRules } from "./dietary";
import { capital, pickProduct, pricePerUnit, type Picked } from "./products";
import { displayName } from "./display";
import { kitchenRound, scaled, total } from "./scale";

/** What the dishes of one menu need of one thing, added up over the dishes. */
export interface Need {
  original: string;
  spec: ProductWords;
  role: RoleId;
  quantity: KitchenAmount;
  swap?: { words: string; reason: string };
  omitted?: boolean;
}

/**
 * Adds up what the dishes need for the guests, one line per thing bought, in the order the dishes name them.
 * `share` gives the part of a full portion each guest eats of a dish (less on a buffet with two warm dishes).
 */
export function needsOf(dishes: AdaptedDish[], guests: number, share: (dish: AdaptedDish) => number = () => 1): Need[] {
  const groups = new Map<string, { need: Omit<Need, "quantity">; unit: KitchenAmount["unit"]; amounts: number[] }>();
  for (const dish of dishes) {
    const { def, items } = dish;
    for (const item of items) {
      const key = `${item.original}|${item.spec.words}|${item.spec.claims?.join(",") ?? ""}|${item.unit}|${item.omitted ? "out" : "in"}`;
      const group = groups.get(key) ?? {
        need: { original: item.original, spec: item.spec, role: item.role, swap: item.swap, omitted: item.omitted },
        unit: item.unit,
        amounts: [],
      };
      group.amounts.push(scaled(item.amount, def.serves, guests * share(dish)));
      groups.set(key, group);
    }
  }
  return [...groups.values()].map(({ need, unit, amounts }) => ({ ...need, quantity: total(amounts, unit) }));
}

/** Everything a shopping line is worked out from. */
export interface ShoppingContext {
  market: Market;
  rules: DietRules;
  /** The kitchen's stock still free for this menu; each line takes what it uses. */
  stock: StockLeft;
  /** Catalogue products for a set of words, already filtered by the rules. */
  find(spec: ProductWords): Product[];
  /** The same without the allergen rules, to tell "not in the catalogue" from "not safe for you". */
  findAny(spec: ProductWords): Product[];
}

export interface PricedLine {
  line: ShoppingLine;
  picked?: Picked;
  /** Net EUR of everything the line needs at the product's price per litre or kilo, stock included: the food cost. */
  foodNet: number;
  /** No price was found to value the line: its food cost is left out and the menu says so. */
  unpriced?: true;
}

/** What is left of the kitchen's stock while one menu's lines are worked out, by words and unit. */
export type StockLeft = Map<string, number>;

export function stockLeft(pantry: PantryItem[]): StockLeft {
  const left: StockLeft = new Map();
  for (const item of pantry) left.set(`${item.words}|${item.unit}`, (left.get(`${item.words}|${item.unit}`) ?? 0) + item.amount);
  return left;
}

/** Takes up to `want` from the stock, so two lines never count the same stock twice. */
function takeFromStock(words: string, unit: KitchenAmount["unit"], want: number, stock: StockLeft): number {
  const key = `${words}|${unit}`;
  const taken = Math.min(want, stock.get(key) ?? 0);
  if (taken > 0) stock.set(key, (stock.get(key) ?? 0) - taken);
  return taken;
}

/** Why there is no product to order, in one sentence. */
function whyNone(spec: ProductWords, ctx: ShoppingContext): string {
  return ctx.findAny(spec).length ? `No ${spec.words} meets your allergen rules.` : `No ${spec.words} was found in the catalogue.`;
}

/** When the product cannot come in full and in time, the first stand-in for the role that can, with its reason. */
function availabilitySwap(need: Need, toOrder: KitchenAmount, picked: Picked | undefined, ctx: ShoppingContext) {
  const why = picked?.problem ?? whyNone(need.spec, ctx);
  for (const swap of ROLES[need.role].swaps) {
    if (swap.words === need.spec.words || !wordsSafe(swap, ctx.rules)) continue;
    const alternative = pickProduct(ctx.find(swap), toOrder, ctx.market, ctx.rules, swap.words);
    if (alternative?.availability === "ok") return { picked: alternative, swap: { words: swap.words, reason: `${why} ${swap.change}` } };
  }
  return undefined;
}

/** The food cost of what the kitchen already has, at the price of the product it would order. */
function foodCost(amount: number, product: Product | undefined, market: Market): Pick<PricedLine, "foodNet" | "unpriced"> {
  const perUnit = product ? pricePerUnit(product, market) : undefined;
  return perUnit === undefined ? { foodNet: 0, unpriced: true } : { foodNet: Math.round(amount * perUnit * 100) / 100 };
}

/** The catalogue name, and the same in sentence case when the catalogue writes it in capitals. */
function productRef(product: Product): NonNullable<ShoppingLine["product"]> {
  const name = product.name.en || product.name.fi;
  return { id: product.id, name, displayName: displayName(name) };
}

/** When the product cannot come in time, a stand-in for the role that the kitchen already has enough of. */
function stockSwap(need: Need, toOrder: KitchenAmount, picked: Picked | undefined, ctx: ShoppingContext): PricedLine | undefined {
  for (const swap of ROLES[need.role].swaps) {
    if (swap.words === need.spec.words || !wordsSafe(swap, ctx.rules)) continue;
    if ((ctx.stock.get(`${swap.words}|${toOrder.unit}`) ?? 0) < toOrder.amount) continue;
    takeFromStock(swap.words, toOrder.unit, toOrder.amount, ctx.stock);
    const why = picked?.problem ?? whyNone(need.spec, ctx);
    const valued = pickProduct(ctx.find(swap), toOrder, ctx.market, ctx.rules, swap.words);
    return {
      ...foodCost(need.quantity.amount, valued?.product, ctx.market),
      line: {
        words: need.original,
        quantity: need.quantity,
        inPantry: need.quantity,
        toOrder: { amount: 0, unit: toOrder.unit },
        availability: "ok",
        swap: { words: swap.words, reason: `${why} Use your ${swap.words} in stock. ${swap.change}` },
      },
    };
  }
  return undefined;
}

function priced(base: Omit<ShoppingLine, "availability">, picked: Picked | undefined, market: Market): PricedLine {
  return {
    picked,
    ...foodCost(base.quantity.amount, picked?.product, market),
    line: {
      ...base,
      product: picked ? productRef(picked.product) : undefined,
      ...(picked?.estNet !== undefined ? { estNet: picked.estNet } : {}),
      availability: picked?.availability ?? "missing",
    },
  };
}

/**
 * One shopping line: what the recipes need, what the kitchen has, what to order and the product for it.
 * A product that cannot arrive in full and in time is replaced by a role swap when one can, and the swap is stated.
 */
export function shoppingLine(need: Need, ctx: ShoppingContext): PricedLine {
  const { quantity, spec } = need;
  if (need.omitted) {
    return { foodNet: 0, line: { words: need.original, quantity, toOrder: { amount: 0, unit: quantity.unit }, availability: "ok", swap: need.swap } };
  }
  const have = takeFromStock(spec.words, quantity.unit, quantity.amount, ctx.stock);
  const toOrder = { amount: kitchenRound(Math.max(0, quantity.amount - have)), unit: quantity.unit };
  const base = {
    words: need.original,
    quantity,
    ...(have > 0 ? { inPantry: { amount: Math.round(have * 10) / 10, unit: quantity.unit } } : {}),
    toOrder,
    ...(need.swap ? { swap: need.swap } : {}),
  };
  if (toOrder.amount === 0) {
    const valued = pickProduct(ctx.find(spec), quantity, ctx.market, ctx.rules, spec.words);
    return { ...foodCost(quantity.amount, valued?.product, ctx.market), line: { ...base, availability: "ok" } };
  }
  const picked = pickProduct(ctx.find(spec), toOrder, ctx.market, ctx.rules, spec.words);
  if (picked?.availability === "ok") return priced(base, picked, ctx.market);
  const fromStock = stockSwap(need, toOrder, picked, ctx);
  if (fromStock) return fromStock;
  const swapped = availabilitySwap(need, toOrder, picked, ctx);
  if (swapped) return priced({ ...base, swap: swapped.swap }, swapped.picked, ctx.market);
  const omit = ROLES[need.role].canOmit;
  if (omit && picked?.availability !== "short") {
    const reason = `${picked?.problem ?? whyNone(spec, ctx)} ${omit}`;
    return { foodNet: 0, line: { ...base, toOrder: { amount: 0, unit: quantity.unit }, availability: "ok", swap: { words: "leave it out", reason } } };
  }
  return priced(base, picked, ctx.market);
}

/** One plain warning for a line that cannot be met: "Cooking cream cannot arrive by Sun 15 Nov." */
export function lineWarning(line: ShoppingLine, deliverBy: string, problem: string | undefined): string | undefined {
  if (line.availability === "ok") return undefined;
  if (line.availability === "short") return problem ?? `Only part of the ${line.words} is in stock.`;
  return line.product ? problem ?? `${capital(line.words)} cannot arrive by ${day(deliverBy)}.` : `No product found for ${line.words}.`;
}
