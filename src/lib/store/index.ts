import { createMemoryStore } from "./memory";
import type { Store } from "./types";

export type { Activity, Store } from "./types";
export type { StoredOrder } from "./memory";
export { dataDir } from "./data-dir";

const globalStore = globalThis as typeof globalThis & { __laituriStore?: Store };

/** One store per process. Held on globalThis so state survives module reloads in development. */
export function store(): Store {
  return (globalStore.__laituriStore ??= createMemoryStore());
}
