import type { JSONWebKeySet } from "jose";
import type { AuditEntry } from "@/lib/contracts";
import { GENESIS_HASH, hashMatches } from "@/lib/audit/verify";
import { verifyWithJwks } from "@/lib/trust/jws";
import { TOKEN_TYPE } from "@/lib/trust/types";
import { count } from "./format/money";
import type { ChainState, Jwks } from "./types";

/**
 * "Verify again", step by step: the browser fetches Valio Aimo's public keys, checks the signature on every entry,
 * then checks that every entry links to the one before it. The counts are the real check's own progress.
 */
export type ReplayStepKey = "keys" | "signatures" | "links";

export const REPLAY_STEPS: readonly { key: ReplayStepKey; title: string }[] = [
  { key: "keys", title: "Fetch the public keys" },
  { key: "signatures", title: "Check every signature" },
  { key: "links", title: "Check every link" },
];

export interface ReplayState {
  status: "idle" | "running" | "verified" | "broken";
  /** Index of the step under way; REPLAY_STEPS.length once every step is done. */
  step: number;
  /** Entries checked in the step under way. */
  done: number;
  total: number;
  keys: number;
  brokenAt?: number;
  reason?: string;
}

export type ReplayEvent =
  | { type: "start"; total: number }
  | { type: "keys"; keys: number }
  | { type: "progress"; done: number }
  | { type: "next" }
  | { type: "verified" }
  | { type: "broken"; brokenAt: number; reason: string };

export const REPLAY_IDLE: ReplayState = { status: "idle", step: 0, done: 0, total: 0, keys: 0 };

export function replayReducer(state: ReplayState, event: ReplayEvent): ReplayState {
  switch (event.type) {
    case "start":
      return { ...REPLAY_IDLE, status: "running", total: event.total };
    case "keys":
      return { ...state, keys: event.keys };
    case "progress":
      return { ...state, done: Math.min(state.total, Math.max(state.done, event.done)) };
    case "next":
      return { ...state, step: Math.min(REPLAY_STEPS.length, state.step + 1), done: 0 };
    case "verified":
      return { ...state, status: "verified", step: REPLAY_STEPS.length, done: 0 };
    case "broken":
      return { ...state, status: "broken", brokenAt: event.brokenAt, reason: event.reason };
  }
}

export interface ReplayStepView {
  key: ReplayStepKey;
  title: string;
  status: "waiting" | "active" | "done" | "failed";
  line: string;
  /** 0..1, for the progress bar of the step under way. */
  fraction: number;
}

function plural(n: number, one: string, many: string): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

function doneLine(key: ReplayStepKey, state: ReplayState): string {
  if (key === "keys") return `${plural(state.keys, "key", "keys")} from Valio Aimo`;
  if (key === "signatures") return `${count(state.total)} of ${count(state.total)} signatures valid`;
  return `${count(state.total)} of ${count(state.total)} links intact`;
}

function activeLine(key: ReplayStepKey, state: ReplayState): string {
  if (key === "keys") return "Fetching from Valio Aimo…";
  const noun = key === "signatures" ? "signatures" : "links";
  return `Checked ${count(state.done)} of ${count(state.total)} ${noun}`;
}

/** What each step shows: waiting, under way with its count, done, or where the log broke. */
export function replayView(state: ReplayState): ReplayStepView[] {
  return REPLAY_STEPS.map(({ key, title }, index) => {
    if (state.status === "idle" || index > state.step) return { key, title, status: "waiting", line: "", fraction: 0 };
    if (index < state.step) return { key, title, status: "done", line: doneLine(key, state), fraction: 1 };
    if (state.status === "broken") {
      return { key, title, status: "failed", line: state.reason ?? `Entry ${state.brokenAt} does not verify.`, fraction: state.total ? state.done / state.total : 0 };
    }
    if (state.status === "verified") return { key, title, status: "done", line: doneLine(key, state), fraction: 1 };
    const fraction = key === "keys" ? 0.5 : state.total ? state.done / state.total : 1;
    return { key, title, status: "active", line: activeLine(key, state), fraction };
  });
}

export interface ReplayOptions {
  /** Fetches the public keys afresh. */
  fetchKeys: () => Promise<Jwks>;
  /** The console's own full check, which also remembers the newest entry seen; its verdict is final. */
  confirm: () => Promise<ChainState>;
  /** Waits between batches so a person sees the counts move; omit it to run at full speed. */
  pace?: () => Promise<void>;
  /** Batches per step when paced. */
  batches?: number;
}

/** Runs the three steps on the entries and reports each one through `dispatch`. Returns the final state. */
export async function runReplay(entries: readonly AuditEntry[], dispatch: (event: ReplayEvent) => void, options: ReplayOptions): Promise<"verified" | "broken"> {
  const ordered = [...entries].sort((a, b) => a.seq - b.seq);
  const total = ordered.length;
  const every = options.pace ? Math.max(1, Math.ceil(total / (options.batches ?? 24))) : total;
  const tick = async (done: number) => {
    if (done % every !== 0 && done !== total) return;
    dispatch({ type: "progress", done });
    if (options.pace) await options.pace();
  };
  const broken = (brokenAt: number, reason: string) => {
    dispatch({ type: "broken", brokenAt, reason });
    return "broken" as const;
  };

  dispatch({ type: "start", total });
  const jwks = await options.fetchKeys();
  dispatch({ type: "keys", keys: jwks.keys.length });
  if (options.pace) await options.pace();
  dispatch({ type: "next" });

  const keys = jwks as unknown as JSONWebKeySet;
  for (const [index, entry] of ordered.entries()) {
    const signed = await verifyWithJwks<{ seq?: unknown; hash?: unknown }>(entry.signature, keys, TOKEN_TYPE.audit);
    if (!signed.valid) return broken(entry.seq, `The signature on entry ${entry.seq} is not valid.`);
    if (signed.payload?.seq !== entry.seq || signed.payload?.hash !== entry.hash) {
      return broken(entry.seq, `The signature on entry ${entry.seq} belongs to a different entry.`);
    }
    await tick(index + 1);
  }
  dispatch({ type: "next" });

  let prev: AuditEntry | undefined;
  for (const [index, entry] of ordered.entries()) {
    if (entry.seq !== (prev ? prev.seq + 1 : 1)) return broken(entry.seq, `An entry is missing before entry ${entry.seq}.`);
    if (entry.prevHash !== (prev ? prev.hash : GENESIS_HASH)) return broken(entry.seq, `Entry ${entry.seq} does not link to the entry before it.`);
    if (!(await hashMatches(entry))) return broken(entry.seq, `Entry ${entry.seq} was changed after it was written.`);
    prev = entry;
    await tick(index + 1);
  }

  const verdict = await options.confirm();
  if (verdict.state === "broken") return broken(verdict.brokenAt, verdict.reason);
  dispatch({ type: "verified" });
  return "verified";
}
