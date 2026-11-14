import { currentWorkspace, sharedWorkspace } from "@/lib/workspace/context";
import type { StoreStatus } from "./memory";
import type { Store } from "./types";

export type { Activity, Store } from "./types";
export type { StoredOrder, StoreStatus } from "./memory";
export { dataDir } from "./data-dir";

/** The current workspace's store: the visitor's sandbox, else the shared store persisted to disk. */
export function store(): Store {
  return currentWorkspace().store;
}

/** The shared store's snapshot set aside at start-up and its last failed save, for the health check. */
export function storeStatus(): StoreStatus {
  return sharedWorkspace().store.status();
}
