import path from "node:path";
import type { AgentSuspension, AuditEntry, Order, SignedOffer } from "@/lib/contracts";
import type { DemandRecord } from "@/lib/demand/types";
import { StorageError } from "@/lib/gateway/errors";
import { dataDir } from "./data-dir";
import { readSnapshot, writeSnapshot, type Recovery } from "./snapshot";
import type { Activity, Store } from "./types";

/** Everything a store holds. Plain JSON, so a copy is a structured clone. */
export interface StoreState {
  offers: Record<string, SignedOffer>;
  orders: Record<string, Order>;
  audit: AuditEntry[];
  activity: Activity[];
  requests: DemandRecord[];
  mandates: Record<string, string>;
  suspensions: Record<string, AgentSuspension>;
}

/** An order as kept by the store: the contract plus the key that makes retries safe. */
export type StoredOrder = Order & { idempotencyKey?: string };

/** Offers, activity and demand records are saved together a moment later; records that commit are saved at once. */
const SNAPSHOT_DELAY_MS = 250;

function emptyState(): StoreState {
  return { offers: {}, orders: {}, audit: [], activity: [], requests: [], mandates: {}, suspensions: {} };
}

function snapshotFile(): string {
  return path.join(dataDir(), "state.json");
}

/** The activity feed is a view for the console, not a record; the audit log is the record. */
const MAX_ACTIVITY = 1000;

function toState(value: unknown): StoreState {
  if (!value || typeof value !== "object") return emptyState();
  const parsed = value as Partial<StoreState>;
  return {
    offers: parsed.offers ?? {},
    orders: parsed.orders ?? {},
    audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    activity: Array.isArray(parsed.activity) ? parsed.activity : [],
    requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    mandates: parsed.mandates && typeof parsed.mandates === "object" ? parsed.mandates : {},
    suspensions: parsed.suspensions && typeof parsed.suspensions === "object" ? parsed.suspensions : {},
  };
}

/** What health reports about the store: a snapshot set aside at start-up, and the last delayed save that failed. */
export interface StoreStatus {
  recovery?: Recovery;
  lastSaveError?: string;
}

export type MemoryStore = Store & {
  /** Saves now. Throws StorageError when the snapshot cannot be written. */
  flush(): void;
  /** A deep copy of everything held, for starting another store from it. */
  copyState(): StoreState;
  /** Replaces everything held with `next`, which it takes over, and saves it. */
  replaceState(next: StoreState): Promise<void>;
  /** The unreadable snapshot that was kept aside at start-up, if there was one. */
  recovery(): Recovery | undefined;
  status(): StoreStatus;
};

/**
 * State in memory with a JSON snapshot on disk. An audit entry, an order, a mandate or a suspension is on disk
 * before the call that wrote it returns; when the write fails the change is undone and the call fails.
 */
export function createMemoryStore(file: string = snapshotFile()): MemoryStore {
  const loaded = readSnapshot(file);
  return storeOver(toState(loaded.value), file, loaded.recovery);
}

/** State in memory only, gone when the store is dropped. It takes over `initial`; pass a copy (see copyState). */
export function createVolatileStore(initial: StoreState = emptyState()): MemoryStore {
  return storeOver(initial);
}

/** `file` absent: nothing is written, so no write can fail. */
function storeOver(initial: StoreState, file?: string, recovery?: Recovery): MemoryStore {
  let state = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSaveError: string | undefined;

  function flush(): void {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!file) return;
    try {
      writeSnapshot(file, state);
      lastSaveError = undefined;
    } catch (error) {
      lastSaveError = (error as Error).message;
      throw new StorageError(`The state could not be saved to disk: ${lastSaveError}`);
    }
  }

  function saveLater(): void {
    if (timer || !file) return;
    timer = setTimeout(() => {
      try {
        flush();
      } catch {
        // Recorded in lastSaveError and reported by health; the next save writes the whole state again.
      }
    }, SNAPSHOT_DELAY_MS);
    timer.unref?.();
  }

  /** Applies a change and saves it before returning; a failed save undoes the change. */
  function commit(apply: () => void, undo: () => void): void {
    apply();
    try {
      flush();
    } catch (error) {
      undo();
      throw error;
    }
  }

  function restoreKey<T>(record: Record<string, T>, key: string, previous: T | undefined): void {
    if (previous === undefined) delete record[key];
    else record[key] = previous;
  }

  return {
    flush,
    recovery: () => recovery,
    status: () => ({ recovery, lastSaveError }),
    copyState: () => structuredClone(state),
    async replaceState(next) {
      const previous = state;
      commit(() => (state = next), () => (state = previous));
    },
    offers: {
      async put(offer) {
        state.offers[offer.offer.id] = offer;
        saveLater();
      },
      async get(id) {
        return state.offers[id];
      },
      async list() {
        return Object.values(state.offers);
      },
    },
    orders: {
      async put(order) {
        const previous = state.orders[order.id];
        commit(() => (state.orders[order.id] = order), () => restoreKey(state.orders, order.id, previous));
      },
      async get(id) {
        return state.orders[id];
      },
      async byIdempotencyKey(key) {
        return Object.values(state.orders).find((order) => idempotencyKeyOf(order) === key);
      },
      async list() {
        return Object.values(state.orders).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      },
    },
    audit: {
      async append(entry) {
        const audit = state.audit;
        commit(() => audit.push(entry), () => audit.pop());
      },
      async list(afterSeq) {
        return afterSeq === undefined ? [...state.audit] : state.audit.filter((entry) => entry.seq > afterSeq);
      },
      async last() {
        return state.audit[state.audit.length - 1];
      },
      async replace(seq, entry) {
        const index = state.audit.findIndex((item) => item.seq === seq);
        if (index === -1) throw new Error(`No audit entry with seq ${seq}.`);
        state.audit[index] = entry;
        saveLater();
      },
    },
    activity: {
      async append(activity) {
        state.activity.push(activity);
        if (state.activity.length > MAX_ACTIVITY) state.activity.splice(0, state.activity.length - MAX_ACTIVITY);
        saveLater();
      },
      async list(afterId) {
        if (afterId === undefined) return [...state.activity];
        const index = state.activity.findIndex((item) => item.id === afterId);
        return index === -1 ? [...state.activity] : state.activity.slice(index + 1);
      },
    },
    requests: {
      async append(record) {
        state.requests.push(record);
        saveLater();
      },
      async list() {
        return [...state.requests];
      },
    },
    mandates: {
      async get(buyerId) {
        return state.mandates[buyerId];
      },
      async put(buyerId, jws) {
        const previous = state.mandates[buyerId];
        commit(() => (state.mandates[buyerId] = jws), () => restoreKey(state.mandates, buyerId, previous));
      },
    },
    suspensions: {
      async get(agentId) {
        return state.suspensions[agentId];
      },
      async put(suspension) {
        const id = suspension.agent.id;
        const previous = state.suspensions[id];
        commit(() => (state.suspensions[id] = suspension), () => restoreKey(state.suspensions, id, previous));
      },
      async remove(agentId) {
        const previous = state.suspensions[agentId];
        commit(() => delete state.suspensions[agentId], () => restoreKey(state.suspensions, agentId, previous));
      },
      async list() {
        return Object.values(state.suspensions);
      },
    },
    async reset() {
      const previous = state;
      commit(() => (state = emptyState()), () => (state = previous));
    },
  };
}

/** The Order contract has no idempotency key, so callers attach it as an extra property (see StoredOrder). */
function idempotencyKeyOf(order: Order): string | undefined {
  const attached = (order as StoredOrder).idempotencyKey;
  return typeof attached === "string" ? attached : undefined;
}
