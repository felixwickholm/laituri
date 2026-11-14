import { OrderOutcome, type Order } from "@/lib/contracts";
import type { OrderStats, OutcomeCounts } from "./types";

export const ORDER_OUTCOMES = OrderOutcome.options;

export function orderOutcome(order: Order): OrderOutcome {
  switch (order.status) {
    case "confirmed":
      return order.approval ? "confirmed_after_approval" : "confirmed_auto";
    case "pending_approval":
      return "waiting";
    case "rejected":
      return "rejected";
    case "blocked":
      return order.refusal ? "refused" : "blocked";
  }
}

/** Sums net amounts in whole cents, so the total is exact. */
export function netOf(orders: Order[]): number {
  return orders.reduce((cents, order) => cents + Math.round(order.offer.totals.net.amount * 100), 0) / 100;
}

export function outcomeCounts(orders: Order[]): OutcomeCounts {
  const counts = Object.fromEntries(ORDER_OUTCOMES.map((outcome) => [outcome, 0])) as OutcomeCounts;
  for (const order of orders) counts[orderOutcome(order)] += 1;
  return counts;
}

export function orderStats(orders: Order[]): OrderStats {
  const byOutcome = Object.fromEntries(
    ORDER_OUTCOMES.map((outcome) => {
      const matching = orders.filter((order) => orderOutcome(order) === outcome);
      return [outcome, { count: matching.length, net: netOf(matching) }];
    }),
  ) as OrderStats["byOutcome"];
  return { total: { count: orders.length, net: netOf(orders) }, byOutcome };
}
