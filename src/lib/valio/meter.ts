import { AsyncLocalStorage } from "node:async_hooks";
import { workspaceState } from "@/lib/workspace/context";

/** Requests that reached the wholesaler's price and availability APIs, and the product ids they carried. */
export interface UpstreamUsage {
  calls: number;
  productsAsked: number;
}

const empty = (): UpstreamUsage => ({ calls: 0, productsAsked: 0 });

// On globalThis: Next loads this module once per route bundle, and every copy must count into one total.
const holder = globalThis as typeof globalThis & { __laituriUpstreamTotal?: UpstreamUsage; __laituriUpstreamScope?: AsyncLocalStorage<UpstreamUsage> };
const total = (holder.__laituriUpstreamTotal ??= empty());
const scope = (holder.__laituriUpstreamScope ??= new AsyncLocalStorage<UpstreamUsage>());
const perWorkspace = workspaceState<UpstreamUsage>("upstream.usage", empty);

/** Counts one request to the wholesaler: in total, in the current workspace and in the work being measured, if any. */
export function recordUpstreamCall(productIds: number): void {
  for (const usage of [total, perWorkspace(), scope.getStore()]) {
    if (!usage) continue;
    usage.calls += 1;
    usage.productsAsked += productIds;
  }
}

/** Runs `work`, counting into `usage` every request it sends the wholesaler. */
export function measuringUpstream<T>(usage: UpstreamUsage, work: () => Promise<T>): Promise<T> {
  return scope.run(usage, work);
}

export function upstreamUsage(): { workspace: UpstreamUsage; total: UpstreamUsage } {
  return { workspace: { ...perWorkspace() }, total: { ...total } };
}
