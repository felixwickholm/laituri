import "../store/temp-data-dir";
import { describe, expect, it } from "vitest";
import { store } from "@/lib/store";
import { createVolatileStore, type MemoryStore, type StoreState } from "@/lib/store/memory";
import { inWorkspace, newWorkspace } from "@/lib/workspace/context";

/** A state saved before baskets and hand-offs existed. */
function olderState(): StoreState {
  const state: Partial<StoreState> = createVolatileStore().copyState();
  delete state.baskets;
  delete state.handoffs;
  return state as StoreState;
}

describe("a store from an earlier version", () => {
  it("starts the collections it lacks empty when copied", async () => {
    const copy = createVolatileStore(olderState());
    expect(await copy.baskets.list()).toEqual([]);
    expect(await copy.handoffs.list()).toEqual([]);
  });

  it("is rebuilt from the same state when a workspace still holds one built without them", async () => {
    const current = createVolatileStore();
    await current.mandates.put("buyer", "jws");
    const stale: Partial<MemoryStore> = { ...current };
    delete stale.baskets;
    delete stale.handoffs;
    const workspace = newWorkspace({ id: "ws_old", kind: "sandbox", label: "Old", store: stale as MemoryStore });
    await inWorkspace(workspace, async () => {
      expect(await store().baskets.list()).toEqual([]);
      expect(await store().mandates.get("buyer")).toBe("jws");
    });
  });
});
