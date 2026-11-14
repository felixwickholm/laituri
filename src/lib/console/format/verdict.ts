import type { WeekStats } from "./orders";

export interface Verdict {
  /** What the person must know first, as one short sentence. */
  lead: string;
  /** Why, or what else is true, in one more sentence. */
  reason: string;
  tone: "calm" | "waiting" | "danger";
}

function orders(n: number): string {
  return n === 1 ? "1 order" : `${n} orders`;
}

/** The Today screen's verdict: the decision first, then the reason, in plain words. */
export function todayVerdict(week: WeekStats, chainBroken: boolean, anyOrders: boolean): Verdict {
  if (chainBroken) {
    return { lead: "The log does not verify.", reason: "Approvals are paused until it is restored. Reset demo restores it.", tone: "danger" };
  }
  if (week.waiting > 0) {
    const rest =
      week.blocked > 0
        ? `${orders(week.blocked)} ${week.blocked === 1 ? "was" : "were"} blocked by your mandate. Everything else ran inside it.`
        : "Everything else ran inside your mandate.";
    return { lead: `${orders(week.waiting)} ${week.waiting === 1 ? "needs" : "need"} you.`, reason: rest, tone: "waiting" };
  }
  if (week.confirmed > 0) {
    return {
      lead: "Nothing needs you.",
      reason: `${orders(week.confirmed)} this week ran inside your mandate${week.blocked > 0 ? `, and ${week.blocked} ${week.blocked === 1 ? "was" : "were"} blocked by it` : ""}.`,
      tone: "calm",
    };
  }
  if (anyOrders) return { lead: "Nothing needs you.", reason: "No orders were confirmed this week yet.", tone: "calm" };
  return { lead: "Nothing needs you yet.", reason: "Ask your agent for something, or run a demo scene.", tone: "calm" };
}
