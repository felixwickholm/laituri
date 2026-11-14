import type { BasketLineRequest, BasketQuantity, CreateBasketRequest, WeeklyDraft, WeeklyDraftLine } from "@/lib/contracts";
import { addDays, helsinkiDate, nextWeekday, shortDay } from "@/lib/agent/dates";
import { count } from "@/lib/offers/format";
import { isoWeekKey } from "@/lib/policy/week";
import { helsinkiInstant } from "@/lib/seed/schedule";
import { driftSentences, type WeekOfOrders } from "./drift";
import { THIS_WEEK, standingOrder, type StandingLine } from "./standing";
import type { StoredBasket } from "./types";

const MONDAY = 1;
/** The wholesaler closes orders for a delivery day at 17:00 the day before, as its recorded answers show. */
const CUTOFF_TIME = "17:00";

/** The standing order is delivered on the next Monday. */
export function weeklyDeliverBy(at: Date): string {
  return nextWeekday(helsinkiDate(at), MONDAY);
}

export function weeklyCutoff(deliverBy: string): string {
  return helsinkiInstant(addDays(deliverBy, -1), CUTOFF_TIME).toISOString();
}

function weeklyTitle(deliverBy: string): string {
  return `Weekly order for ${shortDay(deliverBy)}`;
}

function lineRequest(line: StandingLine, amount: number): CreateBasketRequest["lines"][number] {
  return { words: line.words, quantity: { amount, unit: line.unit }, ...(line.productId ? { productId: line.productId } : {}) };
}

/**
 * The standing order of one week as a basket request: this week by default. An older week can be limited to the
 * lines that show a trend, which is all the seed needs to give drift its data.
 */
export function weeklyRequest(buyerId: string, deliverBy: string, week: number = THIS_WEEK, trendOnly = false): CreateBasketRequest {
  const lines = standingOrder(buyerId)
    .filter((line) => !trendOnly || line.trend)
    .flatMap((line) => {
      const amount = line.weeks[week];
      return amount === undefined ? [] : [lineRequest(line, amount)];
    });
  return { title: weeklyTitle(deliverBy), deliverBy, source: "weekly", lines };
}

/**
 * The product last week's basket ordered for the same words, when that line ended green: a standing order keeps its
 * product from week to week. None for a line whose product the kitchen fixed, or that was not ordered last week.
 */
export function usualProductId(previous: StoredBasket | undefined, request: BasketLineRequest): string | undefined {
  if (request.productId || !previous) return undefined;
  const last = previous.lines.find((line) => line.words === request.words && line.state === "green");
  return last?.product?.id;
}

/** The buyer's weekly basket for that delivery day, if one was started: a standing order runs once per delivery. */
export function weeklyBasketFor(baskets: StoredBasket[], buyerId: string, deliverBy: string): StoredBasket | undefined {
  return baskets.find((basket) => basket.source === "weekly" && basket.buyer.id === buyerId && basket.deliverBy === deliverBy);
}

export function weeklyStarted(baskets: StoredBasket[], buyerId: string, deliverBy: string): boolean {
  return weeklyBasketFor(baskets, buyerId, deliverBy) !== undefined;
}

/** The buyer's finished weekly baskets of ISO weeks before the basket's own, the latest of each, oldest first. */
export function earlierWeeks(baskets: StoredBasket[], basket: Pick<StoredBasket, "buyer" | "createdAt">): StoredBasket[] {
  const week = isoWeekKey(new Date(basket.createdAt));
  return weeklyHistory(baskets, basket.buyer.id).filter((other) => isoWeekKey(new Date(other.createdAt)) < week);
}

/** The buyer's finished weekly baskets, the latest of each ISO week, oldest first. */
export function weeklyHistory(baskets: StoredBasket[], buyerId: string): StoredBasket[] {
  const byWeek = new Map<string, StoredBasket>();
  const own = baskets
    .filter((basket) => basket.buyer.id === buyerId && basket.source === "weekly" && basket.status === "done")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const basket of own) byWeek.set(isoWeekKey(new Date(basket.createdAt)), basket);
  return [...byWeek.values()];
}

function changeOf(amount: number, last?: BasketQuantity): WeeklyDraftLine["change"] {
  if (!last) return "new";
  if (amount === last.amount) return "same";
  return amount > last.amount ? "more" : "less";
}

function noteOf(line: StandingLine, change: WeeklyDraftLine["change"], last?: BasketQuantity): string | undefined {
  if (line.note) return line.note;
  if (!last || change === "same") return undefined;
  return `${change === "more" ? "Up" : "Down"} from ${count(last.amount)} ${last.unit} last week.`;
}

/**
 * This week's standing order, with last week's quantities from the buyer's last weekly basket before this week and
 * the drift of the weeks before this one.
 */
export function weeklyDraft(buyerId: string, baskets: StoredBasket[], at: Date): WeeklyDraft {
  const deliverBy = weeklyDeliverBy(at);
  const thisWeek = isoWeekKey(at);
  const history = weeklyHistory(baskets, buyerId).filter((basket) => isoWeekKey(new Date(basket.createdAt)) !== thisWeek);
  const previous = history.at(-1);
  const standing = standingOrder(buyerId);
  const lines = standing.flatMap((line): WeeklyDraftLine[] => {
    const amount = line.weeks[THIS_WEEK];
    const asked = previous?.lines.find((candidate) => candidate.words === line.words)?.request.quantity;
    const change = changeOf(amount, asked);
    const note = noteOf(line, change, asked);
    return [{ words: line.words, quantity: { amount, unit: line.unit }, ...(asked ? { lastWeek: asked } : {}), change, ...(note ? { note } : {}) }];
  });
  const label = new Map(standing.map((line) => [line.words, line.label]));
  const weeks: WeekOfOrders[] = history.map((basket) => ({
    lines: basket.lines.flatMap((line) => {
      const name = label.get(line.words);
      return name ? [{ label: name, amount: line.request.quantity.amount, unit: line.request.quantity.unit }] : [];
    }),
  }));
  return {
    title: weeklyTitle(deliverBy),
    deliverBy,
    cutoff: weeklyCutoff(deliverBy),
    lines,
    drift: driftSentences(weeks).map((sentence) => ({ sentence })),
  };
}

