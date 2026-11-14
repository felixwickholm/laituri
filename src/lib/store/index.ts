import { currentWorkspace, sharedWorkspace, type Workspace } from "@/lib/workspace/context";
import { createMemoryStore, createVolatileStore, type MemoryStore, type StoreStatus } from "./memory";
import type { Store } from "./types";

export type { Activity, Store } from "./types";
export type { StoredOrder, StoreStatus } from "./memory";
export { dataDir } from "./data-dir";

/** True when the store was built with every collection this version of the store has. */
function hasEveryCollection(store: MemoryStore): boolean {
  return store.baskets !== undefined && store.handoffs !== undefined;
}

/**
 * A workspace outlives a code reload on a development server, so its store may have been built by an earlier version
 * of this module without the collections added since. It is rebuilt once from the same state: the shared store from
 * its snapshot after saving it, an in-memory store from a copy.
 */
function upToDate(workspace: Workspace): MemoryStore {
  if (hasEveryCollection(workspace.store)) return workspace.store;
  if (workspace.kind === "shared") {
    workspace.store.flush();
    workspace.store = createMemoryStore();
  } else {
    workspace.store = createVolatileStore(workspace.store.copyState());
  }
  return workspace.store;
}

/** The current workspace's store: the visitor's sandbox, else the shared store persisted to disk. */
export function store(): Store {
  return upToDate(currentWorkspace());
}

/** The shared store's snapshot set aside at start-up and its last failed save, for the health check. */
export function storeStatus(): StoreStatus {
  return sharedWorkspace().store.status();
}
