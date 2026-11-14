import { workspaceState } from "@/lib/workspace/context";

/** The last order decision queued in this workspace. */
const decisionQueue = workspaceState<{ last: Promise<unknown> }>("orders.lock", () => ({ last: Promise.resolve() }));

/**
 * Runs one workspace's order decisions one at a time. The spend check and the write that follows must not
 * interleave with another order, or two orders could each pass a limit that only one fits under.
 */
export function serial<T>(work: () => Promise<T>): Promise<T> {
  const queue = decisionQueue();
  const next = queue.last.catch(() => undefined).then(work);
  queue.last = next;
  return next;
}
