import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AuditEntry, Order, SignedOffer } from "@/lib/contracts";
import { dataDir } from "./data-dir";
import type { Activity, Store } from "./types";

interface State {
  offers: Record<string, SignedOffer>;
  orders: Record<string, Order>;
  audit: AuditEntry[];
  activity: Activity[];
  mandateJws?: string;
}

/** An order as kept by the store: the contract plus the key that makes retries safe. */
export type StoredOrder = Order & { idempotencyKey?: string };

const SNAPSHOT_DELAY_MS = 250;

function emptyState(): State {
  return { offers: {}, orders: {}, audit: [], activity: [] };
}

function snapshotFile(): string {
  return path.join(dataDir(), "state.json");
}

/** Reads the last snapshot. A missing or unreadable file starts an empty state. */
function loadState(file: string): State {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<State>;
    return {
      offers: parsed.offers ?? {},
      orders: parsed.orders ?? {},
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      mandateJws: typeof parsed.mandateJws === "string" ? parsed.mandateJws : undefined,
    };
  } catch {
    return emptyState();
  }
}

export function createMemoryStore(file: string = snapshotFile()): Store & { flush(): void } {
  let state = loadState(file);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush(): void {
    if (timer) clearTimeout(timer);
    timer = undefined;
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(state));
      renameSync(tmp, file);
    } catch (error) {
      console.error(`Could not save state to ${file}:`, (error as Error).message);
    }
  }

  function changed(): void {
    if (timer) return;
    timer = setTimeout(flush, SNAPSHOT_DELAY_MS);
    timer.unref?.();
  }

  return {
    flush,
    offers: {
      async put(offer) {
        state.offers[offer.offer.id] = offer;
        changed();
      },
      async get(id) {
        return state.offers[id];
      },
    },
    orders: {
      async put(order) {
        state.orders[order.id] = order;
        changed();
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
        state.audit.push(entry);
        changed();
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
        changed();
      },
    },
    activity: {
      async append(activity) {
        state.activity.push(activity);
        changed();
      },
      async list(afterId) {
        if (afterId === undefined) return [...state.activity];
        const index = state.activity.findIndex((item) => item.id === afterId);
        return index === -1 ? [...state.activity] : state.activity.slice(index + 1);
      },
    },
    mandate: {
      async get() {
        return state.mandateJws;
      },
      async put(jws) {
        state.mandateJws = jws;
        changed();
      },
    },
    async reset() {
      state = emptyState();
      flush();
    },
  };
}

/** The Order contract has no idempotency key, so callers attach it as an extra property (see StoredOrder). */
function idempotencyKeyOf(order: Order): string | undefined {
  const attached = (order as StoredOrder).idempotencyKey;
  return typeof attached === "string" ? attached : undefined;
}
