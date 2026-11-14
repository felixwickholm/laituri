import type { LineHistory, Order } from "@/lib/contracts";
import { helsinkiDate } from "@/lib/agent/dates";
import { isoWeekKey } from "@/lib/policy/week";
import type { StoredBasket } from "./types";

/** How often this buyer had the product confirmed before `except`, and when last. */
export function productHistory(orders: Order[], buyerId: string, productId: string, except?: string): LineHistory {
  const earlier = orders.filter(
    (order) =>
      order.id !== except &&
      order.buyer.id === buyerId &&
      order.status === "confirmed" &&
      order.offer.lines.some((line) => line.productId === productId && line.quantity > 0),
  );
  const last = earlier.map((order) => order.createdAt).sort().at(-1);
  return { timesOrdered: earlier.length, ...(last ? { lastOrdered: helsinkiDate(new Date(last)) } : {}) };
}

/**
 * The buyer's latest finished basket of the same source in an earlier ISO week: last week's standing order for a
 * weekly one. A basket of the same week is never "last week", even when it ran first.
 */
export function previousBasket(baskets: StoredBasket[], basket: Pick<StoredBasket, "id" | "buyer" | "source" | "createdAt">): StoredBasket | undefined {
  const week = isoWeekKey(new Date(basket.createdAt));
  return baskets
    .filter((other) => other.id !== basket.id && other.buyer.id === basket.buyer.id && other.source === basket.source)
    .filter((other) => other.status === "done" && other.createdAt < basket.createdAt && isoWeekKey(new Date(other.createdAt)) < week)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
}

/** Whether last week's basket ordered the same product in the same quantity. */
export function sameAsBefore(previous: StoredBasket | undefined, productId: string, asked: { amount: number; unit: string }): boolean {
  return Boolean(
    previous?.lines.some(
      (line) => line.state === "green" && line.product?.id === productId && line.asked.amount === asked.amount && line.asked.unit === asked.unit,
    ),
  );
}
