import type { Actor, AuditEntry, AuditEvent } from "@/lib/contracts";
import { now } from "@/lib/clock";
import { store } from "@/lib/store";
import { trust } from "@/lib/trust";
import { GENESIS_HASH, entryHash } from "./verify";

export interface AuditInput {
  actor: Actor;
  event: AuditEvent;
  summary: string;
  refs?: AuditEntry["refs"];
  data?: AuditEntry["data"];
}

const globalQueue = globalThis as typeof globalThis & { __laituriAuditQueue?: Promise<unknown> };

/** Appends one signed entry. Calls run one at a time so concurrent writers cannot fork the chain. */
export function appendAudit(input: AuditInput): Promise<AuditEntry> {
  const previous = globalQueue.__laituriAuditQueue ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => write(input));
  globalQueue.__laituriAuditQueue = next;
  return next;
}

async function write(input: AuditInput): Promise<AuditEntry> {
  const log = store().audit;
  const last = await log.last();
  const draft: AuditEntry = {
    seq: last ? last.seq + 1 : 1,
    at: now().toISOString(),
    actor: input.actor,
    event: input.event,
    summary: input.summary,
    refs: plainJson(input.refs ?? {}),
    data: plainJson(input.data ?? {}),
    prevHash: last ? last.hash : GENESIS_HASH,
    hash: "",
    signature: "",
  };
  draft.hash = await entryHash(draft);
  draft.signature = await trust().sign("supplier", { seq: draft.seq, hash: draft.hash }, { typ: "audit+jwt" });
  await log.append(draft);
  return draft;
}

/** Stored entries must equal what a snapshot reload gives back, or their hashes would change. */
function plainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
