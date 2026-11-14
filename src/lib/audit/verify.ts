import type { AuditEntry, AuditRecord, AuditStub, AuditVerification } from "@/lib/contracts";
import { sha256Hex } from "@/lib/trust/canonical";
import type { Verified } from "@/lib/trust/types";

/** prevHash of the first entry. */
export const GENESIS_HASH = "0".repeat(64);

/**
 * The size and newest hash a verifier saw earlier. A hash chain alone cannot show that its
 * tail was cut off, so completeness is checked against this remembered head.
 */
export interface LogHead {
  size: number;
  head: string;
}

export type SignatureVerifier = (jws: string) => Promise<Verified<unknown>>;

/** The content of an entry, covered by its contentDigest: what a stub leaves out. */
function contentPart(entry: AuditEntry) {
  return {
    actor: entry.actor,
    summary: entry.summary,
    refs: entry.refs,
    data: entry.data,
    ...(entry.seeded ? { seeded: entry.seeded } : {}),
  };
}

export function contentDigest(entry: AuditEntry): Promise<string> {
  return sha256Hex(contentPart(entry));
}

/** What the hash covers: the chain fields and the content digest, all of which a stub keeps. */
function chainPart(entry: AuditStub | AuditEntry, digest: string) {
  return { seq: entry.seq, at: entry.at, event: entry.event, prevHash: entry.prevHash, contentDigest: digest };
}

/** The hash of an entry written now, from its own content. */
export async function entryHash(entry: AuditEntry): Promise<string> {
  return sha256Hex(chainPart(entry, await contentDigest(entry)));
}

/** The hash of an entry written before content digests: every field except hash and signature. */
export function legacyEntryHash(entry: AuditEntry): Promise<string> {
  return sha256Hex({
    seq: entry.seq,
    at: entry.at,
    actor: entry.actor,
    event: entry.event,
    summary: entry.summary,
    refs: entry.refs,
    data: entry.data,
    ...(entry.seeded ? { seeded: entry.seeded } : {}),
    prevHash: entry.prevHash,
  });
}

export function isStub(record: AuditRecord): record is AuditStub {
  return "redacted" in record && record.redacted === true;
}

/**
 * The hash a record must carry. A full entry recomputes its content digest; a stub is checked from the fields it keeps.
 * A legacy stub cannot be recomputed, so it stands on its link and its signature alone.
 */
async function expectedHash(record: AuditRecord): Promise<string | undefined> {
  if (isStub(record)) {
    if (record.legacy) return record.hash;
    return record.contentDigest ? sha256Hex(chainPart(record, record.contentDigest)) : undefined;
  }
  if (record.contentDigest === undefined) return legacyEntryHash(record);
  const digest = await contentDigest(record);
  return digest === record.contentDigest ? sha256Hex(chainPart(record, digest)) : undefined;
}

/** True when the record's stored hash is the one its fields give. */
export async function hashMatches(record: AuditRecord): Promise<boolean> {
  return (await expectedHash(record)) === record.hash;
}

/** Another buyer's entry for a reader who may verify the chain but not see the content. */
export function redactEntry(entry: AuditEntry): AuditStub {
  const { seq, at, event, prevHash, contentDigest: digest, hash, signature } = entry;
  if (digest === undefined) return { seq, at, event, prevHash, hash, signature, redacted: true, legacy: true };
  return { seq, at, event, prevHash, contentDigest: digest, hash, signature, redacted: true };
}

/** The log as one buyer's agent reads it: that buyer's entries in full, every other entry as a stub. */
export function entriesForBuyer(entries: AuditEntry[], buyerId: string): AuditRecord[] {
  return entries.map((entry) => (entry.refs.buyerId === buyerId ? entry : redactEntry(entry)));
}

/**
 * Checks hashes, links and signatures of a whole log, oldest first, full entries and stubs alike.
 * Pure and browser-safe: pass a verifier built from the public JWKS.
 */
export async function verifyChain(
  entries: AuditRecord[],
  verifySignature: SignatureVerifier,
  expected?: LogHead,
): Promise<AuditVerification> {
  let prev: AuditRecord | undefined;
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
    if (!(await hashMatches(entry))) {
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
  const inconsistency = expected ? prefixInconsistency(entries, expected) : undefined;
  if (inconsistency) return { valid: false, entries: entries.length, ...inconsistency };
  return { valid: true, entries: entries.length, head: prev?.hash };
}

/**
 * A log may only grow: the entry at the remembered size must still carry the remembered hash,
 * whatever the log's length now. Run after the chain itself verified, so that one entry vouches for all before it.
 */
function prefixInconsistency(entries: AuditRecord[], expected: LogHead): { brokenAt: number; reason: string } | undefined {
  if (expected.size === 0) return undefined;
  if (entries.length < expected.size) {
    return {
      brokenAt: entries.length + 1,
      reason: `The log holds ${entries.length} entries but ${expected.size} were recorded. The newest entries were removed.`,
    };
  }
  if (entries[expected.size - 1].hash !== expected.head) {
    return {
      brokenAt: expected.size,
      reason: `Entry ${expected.size} is not the one recorded earlier, so the log was rewritten from there on.`,
    };
  }
  return undefined;
}
