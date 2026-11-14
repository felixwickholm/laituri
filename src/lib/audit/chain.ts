import type { Actor, AuditEntry, AuditEvent } from "@/lib/contracts";
import { now } from "@/lib/clock";
import { AuditBrokenError } from "@/lib/gateway/errors";
import { seededMark } from "@/lib/provenance";
import { store } from "@/lib/store";
import { TOKEN_TYPE, trust } from "@/lib/trust";
import { workspaceState } from "@/lib/workspace/context";
import { knownHead, rememberHead } from "./head";
import { tailProblem } from "./tail";
import { GENESIS_HASH, contentDigest, entryHash } from "./verify";

export interface AuditInput {
  actor: Actor;
  event: AuditEvent;
  summary: string;
  refs?: AuditEntry["refs"];
  data?: AuditEntry["data"];
}

/** The last append queued in this workspace; each workspace's chain is written one entry at a time. */
const appendQueue = workspaceState<{ last: Promise<unknown> }>("audit.queue", () => ({ last: Promise.resolve() }));

/**
 * Appends one signed entry. Calls run one at a time so concurrent writers cannot fork the chain.
 * The stored tail is checked first: an entry is never chained onto a tail that was changed, cut or replaced.
 */
export function appendAudit(input: AuditInput): Promise<AuditEntry> {
  return afterAuditWrites(() => write(input));
}

/**
 * Runs `work` in this workspace's audit queue, after every append already queued and before any later one.
 * A reset must run here: an append that read the old tail would otherwise chain onto a log that is gone.
 * `work` must not append itself, or it waits on its own turn.
 */
export function afterAuditWrites<T>(work: () => Promise<T>): Promise<T> {
  const queue = appendQueue();
  const next = queue.last.catch(() => undefined).then(work);
  queue.last = next;
  return next;
}

async function write(input: AuditInput): Promise<AuditEntry> {
  const log = store().audit;
  const last = await log.last();
  const [beforeLast] = last && last.seq > 1 ? await log.list(last.seq - 2) : [];
  const entryAt = async (seq: number) => (await log.list(seq - 1))[0];
  const problem = await tailProblem(last, beforeLast, (jws) => trust().verify("supplier", jws, TOKEN_TYPE.audit), knownHead(), entryAt);
  if (problem) throw new AuditBrokenError(`Nothing was written to the audit log. ${problem}`);
  const draft: AuditEntry = {
    seq: last ? last.seq + 1 : 1,
    at: now().toISOString(),
    actor: input.actor,
    event: input.event,
    summary: input.summary,
    refs: plainJson(input.refs ?? {}),
    data: plainJson(input.data ?? {}),
    ...seededMark(),
    prevHash: last ? last.hash : GENESIS_HASH,
    contentDigest: "",
    hash: "",
    signature: "",
  };
  draft.contentDigest = await contentDigest(draft);
  draft.hash = await entryHash(draft);
  draft.signature = await trust().sign("supplier", { seq: draft.seq, hash: draft.hash }, TOKEN_TYPE.audit);
  await log.append(draft);
  rememberHead({ size: draft.seq, head: draft.hash });
  return draft;
}

/** Stored entries must equal what a snapshot reload gives back, or their hashes would change. */
function plainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
