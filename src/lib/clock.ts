import { AsyncLocalStorage } from "node:async_hooks";

const holder = globalThis as typeof globalThis & { __laituriClock?: AsyncLocalStorage<() => Date> };
const override = (holder.__laituriClock ??= new AsyncLocalStorage<() => Date>());

/**
 * Single source of time. LAITURI_NOW pins the clock so recorded upstream data stays consistent in tests and evals.
 * Work started with withClock reads its own clock instead, so demo history can be written at past times.
 */
export function now(): Date {
  const clock = override.getStore();
  if (clock) return clock();
  const pinned = process.env.LAITURI_NOW;
  return pinned ? new Date(pinned) : new Date();
}

/** Runs `work` with `clock` as the time source for every call to now() it makes, and only for those. */
export function withClock<T>(clock: () => Date, work: () => Promise<T>): Promise<T> {
  return override.run(clock, work);
}
