"use client";

import type { Basket, Handoff } from "@/lib/contracts";
import { ApiError } from "@/lib/console/api";
import type { Activity } from "@/lib/store/types";
import { supplierApi } from "./api";
import { buyersOf } from "./format";
import { Poller, usePolled, type Polled } from "./poller";
import type { ControlOverview } from "./types";

const OVERVIEW_MS = 2000;
const LIVE_MS = 1500;
const QUESTIONS_MS = 4000;

export const overviewPoller = new Poller<ControlOverview>(supplierApi.overview, OVERVIEW_MS);

/**
 * Every buyer's activity, merged. The buyers are the ones behind the agents the overview lists; on a first load
 * this waits for the overview poller's own request rather than asking for the overview a second time.
 */
export const activityPoller = new Poller<Activity[]>(async () => {
  const overview = await overviewPoller.current();
  if (!overview) {
    const { locked, error } = overviewPoller.getSnapshot();
    throw locked ? new ApiError(401, "A credential is required.", "credential_required") : new Error(error ?? "The overview did not load.");
  }
  const buyers = buyersOf(overview.agents);
  const lists = await Promise.all(buyers.map((buyer) => supplierApi.activity(buyer.id)));
  return lists.flat();
}, LIVE_MS);

export function useOverview(): Polled<ControlOverview> {
  return usePolled(overviewPoller);
}

export function useAllActivity(): Polled<Activity[]> {
  return usePolled(activityPoller);
}

/** Questions from kitchens to a person at Valio Aimo. Reading them all needs the operator session. */
export const handoffsPoller = new Poller<Handoff[]>(supplierApi.handoffs, QUESTIONS_MS);

/** Every buyer's multi-line orders, so a question or a weekly order reads as one event. */
export const basketsPoller = new Poller<Basket[]>(supplierApi.baskets, OVERVIEW_MS);

export function useHandoffs(): Polled<Handoff[]> {
  return usePolled(handoffsPoller);
}

export function useBaskets(): Polled<Basket[]> {
  return usePolled(basketsPoller);
}
