import type { AuditEntry, AuditVerification } from "@/lib/contracts";
import { sha256Hex } from "@/lib/trust/canonical";
import type { Verified } from "@/lib/trust/types";

/** prevHash of the first entry. */
export const GENESIS_HASH = "0".repeat(64);

export type SignatureVerifier = (jws: string) => Promise<Verified<unknown>>;

/** The fields the hash covers: every field except hash and signature. */
export function hashedPart(entry: AuditEntry): Omit<AuditEntry, "hash" | "signature"> {
  return {
    seq: entry.seq,
    at: entry.at,
    actor: entry.actor,
    event: entry.event,
    summary: entry.summary,
    refs: entry.refs,
    data: entry.data,
    prevHash: entry.prevHash,
  };
}

export function entryHash(entry: AuditEntry): Promise<string> {
  return sha256Hex(hashedPart(entry));
}

/**
 * Checks hashes, links and signatures of a full log, oldest first.
 * Pure and browser-safe: pass a verifier built from the public JWKS.
 */
export async function verifyChain(entries: AuditEntry[], verifySignature: SignatureVerifier): Promise<AuditVerification> {
  let prev: AuditEntry | undefined;
  for (const entry of entries) {
    const broken = (reason: string): AuditVerification => ({
      valid: false,
      entries: entries.length,
      brokenAt: entry.seq,
      reason,
    });

    const expectedSeq = prev ? prev.seq + 1 : 1;
    if (entry.seq !== expectedSeq) {
      return broken(`Entry ${entry.seq} follows entry ${prev?.seq ?? 0}, so an entry is missing or out of order.`);
    }
    const expectedPrev = prev ? prev.hash : GENESIS_HASH;
    if (entry.prevHash !== expectedPrev) {
      return broken(`Entry ${entry.seq} does not link to the hash of the entry before it.`);
    }
    if ((await entryHash(entry)) !== entry.hash) {
      return broken(`Entry ${entry.seq} was changed after it was written.`);
    }
    const signed = await verifySignature(entry.signature);
    const payload = signed.payload as { seq?: unknown; hash?: unknown } | undefined;
    if (!signed.valid) {
      return broken(`The signature on entry ${entry.seq} is not valid: ${signed.reason ?? "unknown reason"}.`);
    }
    if (payload?.seq !== entry.seq || payload?.hash !== entry.hash) {
      return broken(`The signature on entry ${entry.seq} belongs to a different entry.`);
    }
    prev = entry;
  }
  return { valid: true, entries: entries.length, head: prev?.hash };
}
