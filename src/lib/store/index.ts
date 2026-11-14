import { createMemoryStore, type MemoryStore, type StoreStatus } from "./memory";
import type { Store } from "./types";

export type { Activity, Store } from "./types";
export type { StoredOrder, StoreStatus } from "./memory";
export { dataDir } from "./data-dir";

const globalStore = globalThis as typeof globalThis & { __laituriStore?: MemoryStore };

function memoryStore(): MemoryStore {
  return (globalStore.__laituriStore ??= createMemoryStore());
}

/** One store per process. Held on globalThis so state survives module reloads in development. */
export function store(): Store {
  return memoryStore();
}

/**
 * A snapshot set aside at start-up and the last failed save, for the health check.
 * A store made by an older module version before a development reload has no status to give.
 */
export function storeStatus(): StoreStatus {
  const current = memoryStore();
  return typeof current.status === "function" ? current.status() : {};
}
