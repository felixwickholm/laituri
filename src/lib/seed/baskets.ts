import { gatewayTransport } from "@/lib/agent";
import { addDays, helsinkiDate, nextWeekday, weekdayOf } from "@/lib/agent/dates";
import { personName } from "@/lib/agent/words";
import { openBasket, runBasket } from "@/lib/basket/engine";
import { recordResolution, settleLine } from "@/lib/basket/settle";
import { THIS_WEEK } from "@/lib/basket/standing";
import type { StoredBasket } from "@/lib/basket/types";
import { weeklyRequest } from "@/lib/basket/weekly";
import { SCRIPTED_CLIENT } from "@/lib/http/client-app";
import { buyerIds } from "@/lib/mandate";
import { store } from "@/lib/store";
import type { PlayContext } from "./play";
import { helsinkiInstant, orderCutoff } from "./schedule";

const DAY_MS = 86_400_000;
const STEP_MS = 20_000;
const MINUTE_MS = 60_000;
const THURSDAY = 4;
/** The weeks of standing orders the seed writes, oldest first; only the last is complete, the older ones carry the trend lines. */
const WEEKS_AGO = [4, 3, 2, 1];
/** When each buyer's agent starts its weekly order on the Thursday, in buyer order. */
const START_TIMES = ["09:30", "10:00", "10:30"];
/** How long the approver takes to sign what waits. */
const APPROVAL_AFTER_MINUTES = 7;

/** The Thursday of the ISO week `weeksAgo` weeks before `end`, in Helsinki. */
function thursdayOf(end: Date, weeksAgo: number): string {
  const day = helsinkiDate(new Date(end.getTime() - weeksAgo * 7 * DAY_MS));
  return addDays(day, THURSDAY - (weekdayOf(day) || 7));
}

/** The approver signs every line that waits, the way the kitchen did that week; the basket line records who and why. */
async function approveWaiting(basket: StoredBasket, ctx: PlayContext): Promise<void> {
  const { mandate } = await ctx.gateway.getMandate(basket.buyer.id);
  const approver = mandate.approval.approver;
  for (const line of basket.lines) {
    const option = line.options?.find((candidate) => candidate.kind === "approve");
    if (line.state !== "orange" || !option || !line.orderId) continue;
    ctx.clock.current = new Date(ctx.clock.current.getTime() + APPROVAL_AFTER_MINUTES * MINUTE_MS);
    const order = await ctx.gateway.decideApproval(line.orderId, { decision: "approved", note: "Part of the weekly order." }, { buyerId: basket.buyer.id });
    const sentence = settleLine(line, order, mandate, await store().orders.list(), personName(approver.name), "Approved");
    await recordResolution(basket, line, option, approver, sentence);
  }
  await store().baskets.put(basket);
}

/** One buyer's standing order of one past week, worked line by line through the seed's gateway on its backdated clock. */
async function playWeek(buyerId: string, weeksAgo: number, start: Date, deliverBy: string, ctx: PlayContext): Promise<number> {
  ctx.clock.current = start;
  ctx.upstream.setSlot({ deliverBy, orderBy: orderCutoff(deliverBy) });
  ctx.hold.validityMs = undefined;
  const agent = await ctx.agentFor(buyerId, SCRIPTED_CLIENT);
  const request = weeklyRequest(buyerId, deliverBy, THIS_WEEK - weeksAgo, weeksAgo > 1);
  const basket = await openBasket(request, { ...agent, buyer: agent.buyer ?? { id: buyerId, name: buyerId } });
  const pause = async () => {
    ctx.clock.current = new Date(ctx.clock.current.getTime() + STEP_MS);
  };
  await runBasket(basket, { agent: basket.agent, transport: gatewayTransport(agent, () => ctx.gateway), pause, concurrency: 1 });
  await approveWaiting(basket, ctx);
  return basket.lines.length;
}

/**
 * The three buyers' standing weekly orders of the last four weeks, each placed on the Thursday for the Monday after:
 * the full order last week, and the lines with a trend before that, so the draft has last week's quantities and drift
 * has four weeks of data. Returns the lines played.
 */
export async function playWeeklyOrders(end: Date, ctx: PlayContext): Promise<number> {
  let lines = 0;
  for (const weeksAgo of WEEKS_AGO) {
    const thursday = thursdayOf(end, weeksAgo);
    const deliverBy = nextWeekday(thursday, 1);
    for (const [index, buyerId] of buyerIds().entries()) {
      lines += await playWeek(buyerId, weeksAgo, helsinkiInstant(thursday, START_TIMES[index] ?? START_TIMES[0]), deliverBy, ctx);
    }
  }
  return lines;
}
