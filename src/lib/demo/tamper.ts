import type { AuditEntry } from "@/lib/contracts";
import { StateError } from "@/lib/gateway/errors";
import { store } from "@/lib/store";
import { demoState } from "./state";

/** The altered entry is put back after this long, so one visitor cannot leave the demo broken for the next. */
const SELF_HEAL_MS = 5 * 60_000;

/** A copy whose money figures are ten times higher. Hash and signature stay as they were. */
function inflate(entry: AuditEntry): AuditEntry {
  const copy = structuredClone(entry);
  const totals = copy.data.totals as { net?: { amount: number }; gross?: { amount: number } } | undefined;
  if (totals?.net) {
    totals.net.amount = Math.round(totals.net.amount * 1000) / 100;
    if (totals.gross) totals.gross.amount = Math.round(totals.gross.amount * 1000) / 100;
  } else {
    copy.data = { ...copy.data, amount: 1_000_000 };
  }
  return copy;
}

/**
 * Quietly edits one stored audit entry, the latest order entry when there is one, so verification fails there.
 * The newest entry is left alone while there are others: the service refuses to chain onto an edited tail.
 */
export async function tamperAudit(): Promise<{ seq: number }> {
  await restoreAudit();
  const entries = await store().audit.list();
  if (entries.length === 0) throw new StateError("The audit log is empty. Run a scene first.");
  const candidates = entries.length > 1 ? entries.slice(0, -1) : entries;
  const target = [...candidates].reverse().find((entry) => entry.event.startsWith("order.")) ?? candidates[Math.floor(candidates.length / 2)];
  demoState().tampered = { seq: target.seq, original: target };
  await store().audit.replace(target.seq, inflate(target));
  const timer = setTimeout(() => void restoreAudit(), SELF_HEAL_MS);
  timer.unref?.();
  return { seq: target.seq };
}

/** Puts the original entry back. False when nothing was tampered with. */
export async function restoreAudit(): Promise<boolean> {
  const state = demoState();
  const tampered = state.tampered;
  if (!tampered) return false;
  state.tampered = undefined;
  await store().audit.replace(tampered.seq, tampered.original);
  return true;
}
