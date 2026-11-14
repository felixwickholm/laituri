"use client";

import { useSyncExternalStore } from "react";
import { basketStore, useBaskets } from "@/lib/console/basket-store";
import { consoleStore, useConsole } from "@/lib/console/store";
import { tourBasket, tourFacts, type ExampleState, type TourFacts } from "@/lib/tour/facts";
import type { TourState } from "@/lib/tour/machine";

/** The last of the four steps the challenge's example shows on Today: Approval, once the order is placed. */
const EXAMPLE_APPROVAL = '[data-tour="milk-result"] [data-tour="flow-steps"] > li:last-child';
const LOOK_MS = 250;

function readExample(): ExampleState | undefined {
  const state = document.querySelector<HTMLElement>(EXAMPLE_APPROVAL)?.dataset.state;
  return state === "done" ? "alone" : state === "current" ? "waits" : state === "failed" || state === "todo" ? "refused" : undefined;
}

function watchExample(onChange: () => void): () => void {
  const timer = setInterval(onChange, LOOK_MS);
  return () => clearInterval(timer);
}

/** The facts the cards quote, live from this visitor's own copy and from what the example shows on screen. */
export function useTourFacts(state: Pick<TourState, "basketId" | "since">): TourFacts {
  const { baskets } = useBaskets();
  const { chain } = useConsole();
  const example = useSyncExternalStore(watchExample, readExample, () => undefined);
  return tourFacts(tourBasket(baskets, state.basketId, state.since), chain.state === "broken", example);
}

/** The same facts read once, outside React, for the runner's watch loop. */
export function readTourFacts(state: Pick<TourState, "basketId" | "since">): TourFacts {
  const basket = tourBasket(basketStore.getSnapshot().baskets, state.basketId, state.since);
  return tourFacts(basket, consoleStore.getSnapshot().chain.state === "broken", readExample());
}
