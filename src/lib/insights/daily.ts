import type { Order } from "@/lib/contracts";
import { addDays, helsinkiDate } from "@/lib/agent/dates";
import { netOf } from "./orders";
import type { DailyPoint, RequestSummary } from "./types";

/** Requests, orders and confirmed net value per Helsinki calendar day, for the `days` days ending today. */
export function dailySeries(requests: RequestSummary[], orders: Order[], now: Date, days = 7): DailyPoint[] {
  const today = helsinkiDate(now);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - days + 1);
    const placed = orders.filter((order) => helsinkiDate(new Date(order.createdAt)) === date);
    return {
      date,
      requests: requests.filter((request) => helsinkiDate(new Date(request.at)) === date).length,
      orders: placed.length,
      confirmedNet: netOf(placed.filter((order) => order.status === "confirmed")),
    };
  });
}
