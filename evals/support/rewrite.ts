import type { AuditEntry } from "@/lib/contracts";
import { GENESIS_HASH, entryHash } from "@/lib/audit/verify";
import { TOKEN_TYPE, trust } from "@/lib/trust";

/**
 * The log as an operator holding the supplier key could rewrite it: the first `keep` entries unchanged,
 * then `add` new entries, each hashed, linked and signed exactly as the service writes them.
 * The result verifies on its own; only a remembered head can tell it from the log it replaced.
 */
export async function rewriteLog(entries: AuditEntry[], keep: number, add: number): Promise<AuditEntry[]> {
  const log = entries.slice(0, keep);
  const template = entries[entries.length - 1];
  for (let i = 0; i < add; i++) {
    const prev = log[log.length - 1];
    const entry: AuditEntry = {
      ...template,
      seq: (prev?.seq ?? 0) + 1,
      summary: `Rewritten entry ${i + 1}.`,
      prevHash: prev?.hash ?? GENESIS_HASH,
      hash: "",
      signature: "",
    };
    entry.hash = await entryHash(entry);
    entry.signature = await trust().sign("supplier", { seq: entry.seq, hash: entry.hash }, TOKEN_TYPE.audit);
    log.push(entry);
  }
  return log;
}
