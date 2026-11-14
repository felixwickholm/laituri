import type { Basket, Handoff, Order } from "@/lib/contracts";

export interface NavSignals {
  /** Basket lines and single orders waiting for the purchasing manager. */
  needsYou: number;
  /** Questions to Valio Aimo nobody has answered yet. */
  questions: number;
  recordBroken: boolean;
}

/**
 * What needs the purchasing manager: every orange basket line, plus each order waiting for approval that is not
 * already one of those lines, so nothing is counted twice.
 */
export function needsYou(baskets: readonly Basket[], orders: readonly Pick<Order, "id" | "status">[]): number {
  const lines = baskets.flatMap((basket) => basket.lines);
  const inBaskets = new Set(lines.map((line) => line.orderId).filter(Boolean));
  const orange = lines.filter((line) => line.state === "orange").length;
  const single = orders.filter((order) => order.status === "pending_approval" && !inBaskets.has(order.id)).length;
  return orange + single;
}

export function openQuestions(handoffs: readonly Pick<Handoff, "status">[]): number {
  return handoffs.filter((handoff) => handoff.status === "open").length;
}
