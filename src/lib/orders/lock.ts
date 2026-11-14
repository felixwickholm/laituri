const globalLock = globalThis as typeof globalThis & { __laituriOrderLock?: Promise<unknown> };

/**
 * Runs order decisions one at a time. The spend check and the write that follows must not
 * interleave with another order, or two orders could each pass a limit that only one fits under.
 */
export function serial<T>(work: () => Promise<T>): Promise<T> {
  const previous = globalLock.__laituriOrderLock ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  globalLock.__laituriOrderLock = next;
  return next;
}
