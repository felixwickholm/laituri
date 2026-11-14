import type { Basket, BasketLine } from "@/lib/contracts";

/**
 * What the walkthrough's cards may say, read from the visitor's own demo copy: the weekly basket the tour started and
 * the state of the record. Every number on a card comes from here, never from the step's text.
 */
/** How the challenge's example on Today ended: ordered alone, waiting for a person, or refused. */
export type ExampleState = "alone" | "waits" | "refused";

export interface TourFacts {
  basket?: Basket;
  lines?: number;
  /** Lines the agent ordered alone: green without a person's answer. */
  alone?: number;
  /** Lines that needed a person: waiting now, or answered already. */
  needed?: number;
  red?: number;
  /** The basket has finished: every line is green, orange or red. */
  done: boolean;
  /** The first line that waits for a person, while it waits. */
  orangeLine?: BasketLine;
  /** A line that waited for a person and now has their answer. */
  answeredLine?: BasketLine;
  redLine?: BasketLine;
  /** Every line that needed a person, in the basket's order: waiting now, or answered already. */
  neededLines: BasketLine[];
  /** The safe product a person can take instead of the red line, when the agent found one. */
  swap?: string;
  recordBroken: boolean;
  example?: ExampleState;
}

/** The product's own sentence told about the customer: the screens say "your", the walkthrough's narrator does not. */
export function narrate(text: string): string {
  return text.replace(/\bYour\b/g, "The customer’s").replace(/\byour\b/g, "the customer’s");
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Only 51 in stock." after a colon reads "only 51 in stock."; an acronym such as "UHT" keeps its capitals. */
function afterColon(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** One line and its reason, as the card says it: "Butter: €150 over the customer’s order limit." */
export function lineWhy(line: BasketLine): string {
  return `${capital(line.words)}: ${afterColon(narrate(line.reason))}`;
}

/** The product a substitute option orders, from its label ("Take Alpro Rice drink 1L instead"). */
export function swapOf(line: BasketLine | undefined): string | undefined {
  const option = line?.options?.find((item) => item.kind === "substitute");
  if (!option) return undefined;
  return /^Take (.+?) instead\.?$/.exec(option.label)?.[1] ?? option.label;
}

/**
 * The tour's basket: the one it started, else, once the tour has begun, the newest weekly basket that is not demo
 * history. Start resets the visitor's copy, so no other such basket can exist. The server's clock may be a fixed demo
 * clock, so times are never compared with the browser's.
 */
export function tourBasket(baskets: readonly Basket[], basketId: string | undefined, since: string | undefined): Basket | undefined {
  if (basketId) return baskets.find((basket) => basket.id === basketId);
  if (!since) return undefined;
  return baskets.find((basket) => !basket.seeded && basket.source === "weekly");
}

export function tourFacts(basket: Basket | undefined, recordBroken: boolean, example?: ExampleState): TourFacts {
  if (!basket) return { done: false, neededLines: [], recordBroken, example };
  const { totals, lines } = basket;
  const answered = (line: BasketLine) => line.resolved !== undefined && line.state !== "red";
  const neededLines = lines.filter((line) => line.state === "orange" || answered(line));
  const redLine = lines.find((line) => line.state === "red");
  return {
    basket,
    lines: totals.lines,
    alone: lines.filter((line) => line.state === "green" && !line.resolved).length,
    needed: neededLines.length,
    red: totals.red,
    done: basket.status === "done",
    orangeLine: lines.find((line) => line.state === "orange" && !line.resolved),
    answeredLine: lines.find(answered),
    redLine,
    neededLines,
    swap: swapOf(redLine),
    recordBroken,
    example,
  };
}

/** The plain conditions a step waits for before its card may describe the result. */
export type ConditionId = "now" | "exampleDone" | "basketStarted" | "basketDone" | "needsPerson" | "blocked" | "recordBroken";

export const CONDITIONS: Record<ConditionId, (facts: TourFacts) => boolean> = {
  now: () => true,
  exampleDone: (facts) => facts.example !== undefined,
  basketStarted: (facts) => facts.basket !== undefined,
  basketDone: (facts) => facts.done,
  needsPerson: (facts) => facts.orangeLine !== undefined || facts.answeredLine !== undefined,
  blocked: (facts) => facts.redLine !== undefined,
  recordBroken: (facts) => facts.recordBroken,
};
