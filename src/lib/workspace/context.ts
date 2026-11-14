import { AsyncLocalStorage } from "node:async_hooks";
import { now } from "@/lib/clock";
import { createMemoryStore, type MemoryStore } from "@/lib/store/memory";

export type WorkspaceKind = "shared" | "sandbox";

/** Per-workspace state a module keeps; `inherit` copies it from the template into each new sandbox. */
interface Slot {
  value: unknown;
  inherit: boolean;
}

/**
 * One isolated copy of all mutable state: the store (offers, orders, audit chain, activity, requests, mandates,
 * suspensions) plus whatever other modules keep per workspace through workspaceState. The catalogue, the signing
 * keys and the upstream client are not in it: every workspace shares them.
 */
export interface Workspace {
  /** Internal: "shared", or a random id per sandbox. Sessions are bound to it. */
  id: string;
  kind: WorkspaceKind;
  /** Public name, safe to show. */
  label: string;
  createdAt: string;
  store: MemoryStore;
  slots: Map<string, Slot>;
}

export const SHARED_WORKSPACE_ID = "shared";

// On globalThis, like the clock: Next loads this module once per route bundle, and every copy must see one context.
const holder = globalThis as typeof globalThis & {
  __laituriWorkspaceContext?: AsyncLocalStorage<Workspace>;
  __laituriSharedWorkspace?: Workspace;
};
const context = (holder.__laituriWorkspaceContext ??= new AsyncLocalStorage<Workspace>());

export function newWorkspace(fields: Omit<Workspace, "createdAt" | "slots">, slots = new Map<string, Slot>()): Workspace {
  return { ...fields, createdAt: now().toISOString(), slots };
}

/** The one workspace that is persisted to disk and seeded at boot. Calls outside any request run here. */
export function sharedWorkspace(): Workspace {
  return (holder.__laituriSharedWorkspace ??= newWorkspace({
    id: SHARED_WORKSPACE_ID,
    kind: "shared",
    label: "Shared demo",
    store: createMemoryStore(),
  }));
}

/** Runs `work`, and everything it starts, background work included, in `workspace`. */
export function inWorkspace<T>(workspace: Workspace, work: () => Promise<T>): Promise<T> {
  return context.run(workspace, work);
}

export function currentWorkspace(): Workspace {
  return context.getStore() ?? sharedWorkspace();
}

/**
 * Module state kept per workspace. Returns an accessor that gives the current workspace's value, created on first use.
 * With `inherit`, a new sandbox starts from a deep copy of the template's value instead.
 */
export function workspaceState<T>(name: string, create: () => T, options: { inherit?: boolean } = {}): () => T {
  return () => {
    const slots = currentWorkspace().slots;
    let slot = slots.get(name);
    if (!slot) {
      slot = { value: create(), inherit: options.inherit === true };
      slots.set(name, slot);
    }
    return slot.value as T;
  };
}

/** Deep copies of the slots a new sandbox inherits from `template`. */
export function inheritedSlots(template: Workspace): Map<string, Slot> {
  const copies = new Map<string, Slot>();
  for (const [name, slot] of template.slots) {
    if (slot.inherit) copies.set(name, { value: structuredClone(slot.value), inherit: true });
  }
  return copies;
}
