import type { Basket, Order } from "@/lib/contracts";
import { basketHeading, basketOrderIds, lineCounts } from "./basket";
import { offerSubject } from "./format/proof";
import { blocks, ruleName } from "./format/rules";

/** The four outcomes a buyer filters by: ordered, needs you, blocked, and refused (not ordered for another reason). */
export type Light = "green" | "orange" | "red" | "refused";

export const LIGHT_FILTERS: { key: Light; label: string }[] = [
  { key: "green", label: "Ordered" },
  { key: "orange", label: "Needs you" },
  { key: "red", label: "Blocked" },
  { key: "refused", label: "Refused" },
];

/** Where a single order stands, in the basket's colours. A rejected or expired order counts as refused. */
export function orderLight(order: Order): Light {
  if (order.refusal) return "refused";
  if (order.status === "confirmed") return "green";
  if (order.status === "pending_approval") return "orange";
  if (order.status === "blocked") return "red";
  return "refused";
}

/** One plain sentence on how a single order ended. */
export function orderSentence(order: Order): string {
  if (order.refusal) return "Refused. The price was not one Valio Aimo signed here.";
  switch (order.status) {
    case "confirmed":
      return order.approval ? "Ordered. Purchasing manager approved." : "Ordered by your agent, inside your limits.";
    case "pending_approval":
      return "Needs the purchasing manager.";
    case "blocked": {
      const [first] = blocks(order);
      return `Blocked: ${first ? ruleName(first.rule).toLowerCase() : "outside your limits"}.`;
    }
    default:
      return order.approval ? "Not ordered. Purchasing manager said no." : "Not ordered. The price ran out.";
  }
}

export type HistoryItem =
  | { kind: "basket"; id: string; at: string; title: string; counts: { green: number; orange: number; red: number; working: number }; net: number; running: boolean; seeded: boolean }
  | { kind: "order"; id: string; at: string; title: string; light: Light; sentence: string; net: number; seeded: boolean };

/** Baskets and the single orders outside them, newest first, as rows of one list. */
export function historyItems(baskets: Basket[], orders: Order[]): HistoryItem[] {
  const inBaskets = basketOrderIds(baskets);
  const rows: HistoryItem[] = [
    ...baskets.map((basket): HistoryItem => ({
      kind: "basket",
      id: basket.id,
      at: basket.createdAt,
      title: basketHeading(basket),
      counts: lineCounts(basket),
      net: basket.totals.netOrdered,
      running: basket.status === "running",
      seeded: basket.seeded === true,
    })),
    ...orders
      .filter((order) => !inBaskets.has(order.id))
      .map((order): HistoryItem => ({
        kind: "order",
        id: order.id,
        at: order.createdAt,
        title: order.offer.intent?.trim() || offerSubject(order.offer),
        light: orderLight(order),
        sentence: orderSentence(order),
        net: order.offer.totals.net.amount,
        seeded: order.seeded === true,
      })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/** A basket matches a filter when any of its lines is in that state; an order when it is. */
export function matchesLight(item: HistoryItem, filter: Light | "all"): boolean {
  if (filter === "all") return true;
  if (item.kind === "order") return item.light === filter;
  return filter === "refused" ? false : item.counts[filter] > 0;
}

/** How many rows each filter would show. */
export function lightCounts(items: HistoryItem[]): Record<Light, number> {
  const tally: Record<Light, number> = { green: 0, orange: 0, red: 0, refused: 0 };
  for (const item of items) for (const { key } of LIGHT_FILTERS) if (matchesLight(item, key)) tally[key] += 1;
  return tally;
}
