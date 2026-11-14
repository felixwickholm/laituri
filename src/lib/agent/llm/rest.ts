import type { ModelEngine } from "./types";

/**
 * A model that answered "too many requests" or "overloaded" rests for a while, for the whole process: the next
 * requests go straight to the next engine instead of waiting on the same refusal (the challenge asks callers to
 * respect a 429 for at least 30 seconds).
 */
export const REST_AFTER_REFUSAL_MS = 60_000;

const holder = globalThis as typeof globalThis & { __laituriEngineRest?: Map<ModelEngine, number> };
const resting = (holder.__laituriEngineRest ??= new Map<ModelEngine, number>());

/** Statuses that mean: not now, try later. */
export function isBusyStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 529;
}

export function restEngine(engine: ModelEngine, now: number = Date.now(), ms: number = REST_AFTER_REFUSAL_MS): void {
  resting.set(engine, now + ms);
}

export function engineResting(engine: ModelEngine, now: number = Date.now()): boolean {
  return (resting.get(engine) ?? 0) > now;
}

/** For tests. */
export function clearEngineRest(): void {
  resting.clear();
}
