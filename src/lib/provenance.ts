import { AsyncLocalStorage } from "node:async_hooks";

const holder = globalThis as typeof globalThis & { __laituriSeeding?: AsyncLocalStorage<true> };
const seeding = (holder.__laituriSeeding ??= new AsyncLocalStorage<true>());

/** Runs `work` as demo history: every order, audit entry, activity and request record it writes is marked seeded. */
export function asSeeded<T>(work: () => Promise<T>): Promise<T> {
  return seeding.run(true, work);
}

/** `{ seeded: true }` inside asSeeded, else nothing. Spread into a record as it is written. */
export function seededMark(): { seeded?: true } {
  return seeding.getStore() ? { seeded: true } : {};
}
