import type { Basket } from "@/lib/contracts";
import { basketVerdict, lineCounts } from "../basket";

export type VerdictTone = "calm" | "waiting" | "danger";

export interface Verdict {
  /** What the person must know first, in one plain sentence or three short ones. */
  text: string;
  tone: VerdictTone;
}

export interface TodayFacts {
  /** This week's basket, when one exists. */
  basket?: Basket;
  /** Single orders, outside any basket, that wait for the purchasing manager. */
  waitingOrders: number;
  chainBroken: boolean;
  suspended: boolean;
}

function others(n: number, basket: boolean): string {
  if (n === 0) return "";
  const what = n === 1 ? "order" : "orders";
  return basket ? ` ${n} other ${what} ${n === 1 ? "needs" : "need"} you.` : `${n} ${what} ${n === 1 ? "needs" : "need"} you.`;
}

/** Today's verdict: "Your agent ordered 17 lines. 2 need you. 1 is blocked." */
export function todayVerdict({ basket, waitingOrders, chainBroken, suspended }: TodayFacts): Verdict {
  if (suspended) return { text: "Valio Aimo stopped your agent. It cannot order now.", tone: "danger" };
  if (chainBroken) return { text: "The record was changed after it was written. Approvals wait until it is fixed.", tone: "danger" };
  if (basket) {
    const n = lineCounts(basket);
    const tone: VerdictTone = n.orange > 0 || waitingOrders > 0 ? "waiting" : "calm";
    return { text: `${basketVerdict(basket)}${others(waitingOrders, true)}`, tone };
  }
  if (waitingOrders > 0) return { text: `Your weekly order is ready to send. ${others(waitingOrders, false)}`, tone: "waiting" };
  return { text: "Your weekly order is ready to send.", tone: "calm" };
}
