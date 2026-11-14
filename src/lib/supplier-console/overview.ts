import type { Basket } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { percent, plural, seconds, unmetInWeek, unmetNet } from "./format";
import type { ControlOverview, OfferStats } from "./types";

export interface OverviewFact {
  key: "auto" | "questions";
  text: string;
  link?: { href: string; label: string };
}

/**
 * The few lines under the verdict: how much was ordered without a person, and how many questions wait. Each appears
 * only when the server reports it, so an older server shows the verdict alone.
 */
export function overviewFacts(overview: ControlOverview): OverviewFact[] {
  const { baskets, handoffs } = overview as Partial<ControlOverview>;
  const facts: OverviewFact[] = [];
  if (baskets && baskets.lines > 0) facts.push({ key: "auto", text: `Lines ordered without a person: ${percent(baskets.autoShare)}` });
  if (handoffs) {
    facts.push(
      handoffs.open > 0
        ? { key: "questions", text: `${plural(handoffs.open, "question waits", "questions wait")} for a person.`, link: { href: "/valio/handoffs", label: "Answer" } }
        : { key: "questions", text: "No question from a customer waits.", link: { href: "/valio/handoffs", label: "Questions" } },
    );
  }
  return facts;
}

/** The offers Valio Aimo signed this period, as short sentences instead of a row of tiles. */
export function offerSentences(offers: OfferStats): string[] {
  if (offers.signed === 0) return ["Valio Aimo has not signed a fixed price yet."];
  const lines = [
    `Valio Aimo signed ${plural(offers.signed, "fixed price")}.`,
    `${count(offers.ordered)} became orders (${percent(offers.conversionRate)}).`,
  ];
  if (offers.expiredUnused > 0) lines.push(`${count(offers.expiredUnused)} ran out unused.`);
  if (offers.open > 0) lines.push(`${count(offers.open)} can still be used.`);
  if (offers.medianSecondsToOrder !== undefined) lines.push(`Typical time from price to order: ${seconds(offers.medianSecondsToOrder)}.`);
  return lines;
}

/**
 * How fast a request became an order. The newest finished basket says it best ("20 lines in 7 s"); without one,
 * the median request-to-order time, when there is a measured one above zero.
 */
export function speedLine(overview: ControlOverview, baskets: Basket[] | undefined): string | undefined {
  const basket = baskets?.find((item) => item.status === "done" && item.totals.secondsTaken !== undefined);
  const taken = basket?.totals.secondsTaken;
  if (basket && taken !== undefined) {
    const took = Math.max(1, Math.round(taken));
    return `${basket.title}: ${plural(basket.totals.lines, "line")} in ${took} s. By hand: about ${count(basket.totals.minutesByHand)} min.`;
  }
  const median = overview.orders.medianSecondsRequestToConfirmed;
  return median !== undefined && median >= 1 ? `Typical time from request to confirmed order: ${seconds(median)}.` : undefined;
}

export interface OverviewTile {
  key: "auto" | "unserved" | "questions" | "agents";
  number: string;
  word: string;
  tone?: "success" | "warn" | "danger";
  href?: string;
}

/**
 * The four count boxes under the verdict, each a number read from the overview and one or two words. A box appears
 * only when the server reports its figure.
 */
export function overviewTiles(overview: ControlOverview): OverviewTile[] {
  const { baskets, handoffs } = overview as Partial<ControlOverview>;
  const tiles: OverviewTile[] = [];
  if (baskets && baskets.lines > 0) tiles.push({ key: "auto", number: percent(baskets.autoShare), word: "without a person", tone: "success" });
  const lost = unmetNet(unmetInWeek(overview.unmet, overview.daily));
  tiles.push({ key: "unserved", number: eur(lost), word: "unserved", tone: lost > 0 ? "warn" : undefined, href: "/valio/demand#unserved" });
  if (handoffs) tiles.push({ key: "questions", number: count(handoffs.open), word: handoffs.open === 1 ? "question waits" : "questions wait", tone: handoffs.open > 0 ? "warn" : undefined, href: "/valio/handoffs" });
  const paused = overview.agents.filter((agent) => agent.status === "suspended").length;
  tiles.push(
    paused > 0
      ? { key: "agents", number: count(paused), word: paused === 1 ? "agent paused" : "agents paused", tone: "danger", href: "/valio/agents" }
      : { key: "agents", number: count(overview.agents.length), word: overview.agents.length === 1 ? "agent" : "agents", href: "/valio/agents" },
  );
  return tiles;
}

/** The verdict's one action: answer waiting questions first, then look at lost demand, else the agents. */
export function overviewAction(overview: ControlOverview): { href: string; label: string } {
  const open = (overview as Partial<ControlOverview>).handoffs?.open ?? 0;
  if (open > 0) return { href: "/valio/handoffs", label: open === 1 ? "Answer the question" : `Answer ${count(open)} questions` };
  if (overview.agents.length === 0) return { href: "/connect", label: "Connect an agent" };
  if (unmetInWeek(overview.unmet, overview.daily).length > 0) return { href: "/valio/demand#unserved", label: "See lost demand" };
  return { href: "/valio/agents", label: "See the agents" };
}
