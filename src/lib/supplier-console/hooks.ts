"use client";

import type { Activity } from "@/lib/store/types";
import { supplierApi } from "./api";
import { buyersOf } from "./format";
import { Poller, usePolled, type Polled } from "./poller";
import type { ControlOverview } from "./types";

const OVERVIEW_MS = 2000;
const LIVE_MS = 1500;

export const overviewPoller = new Poller<ControlOverview>(supplierApi.overview, OVERVIEW_MS);

/** Every buyer's activity, merged. The buyers are the ones behind the agents the overview lists. */
export const activityPoller = new Poller<Activity[]>(async () => {
  const overview = overviewPoller.getSnapshot().data ?? (await supplierApi.overview());
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
