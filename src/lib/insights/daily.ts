import type { Order } from "@/lib/contracts";
import { addDays, helsinkiDate } from "@/lib/agent/dates";
import { netOf } from "./orders";
import type { DailyPoint, RequestSummary } from "./types";

/**
 * Requests, orders and confirmed net value per Helsinki calendar day, for the `days` days ending today.
 * `ordered` counts the day's requests that led to an order (their ids are in `orderedRequests`), so it never
 * exceeds `requests`; `orders` counts every order placed that day, and one request can lead to several.
 */
export function dailySeries(requests: RequestSummary[], orders: Order[], orderedRequests: ReadonlySet<string>, now: Date, days = 7): DailyPoint[] {
  const today = helsinkiDate(now);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - days + 1);
    const started = requests.filter((request) => helsinkiDate(new Date(request.at)) === date);
    const placed = orders.filter((order) => helsinkiDate(new Date(order.createdAt)) === date);
    const confirmed = placed.filter((order) => order.status === "confirmed");
    return {
      date,
      requests: started.length,
      ordered: started.filter((request) => orderedRequests.has(request.requestId)).length,
      orders: placed.length,
      confirmed: confirmed.length,
      confirmedNet: netOf(confirmed),
    };
  });
}
