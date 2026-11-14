import type { AuditEntry } from "@/lib/contracts";
import { GENESIS_HASH, hashMatches, type LogHead, type SignatureVerifier } from "./verify";

/**
 * Why the stored tail cannot be extended, or undefined when it can. The tail must hash to its stored hash,
 * carry the wholesaler's signature over its own seq and hash, link to the entry before it, and agree with
 * the newest head this process wrote: the log may not be shorter, and the entry at that seq must be the one written.
 * `beforeTail` is the entry before the tail, absent when the tail is the first entry.
 */
export async function tailProblem(
  tail: AuditEntry | undefined,
  beforeTail: AuditEntry | undefined,
  verifySignature: SignatureVerifier,
  known: LogHead | undefined,
  entryAt: (seq: number) => Promise<AuditEntry | undefined>,
): Promise<string | undefined> {
  const size = tail?.seq ?? 0;
  if (known && size < known.size) {
    return `The log holds ${size} entries but ${known.size} were written. The newest entries were removed.`;
  }
  if (known && known.size > 0 && (await entryAt(known.size))?.hash !== known.head) {
    return `Entry ${known.size} is not the one written earlier, so the log was rewritten.`;
  }
  if (!tail) return undefined;
  if (!(await hashMatches(tail))) return `Entry ${tail.seq} was changed after it was written.`;
  if (tail.prevHash !== (beforeTail?.hash ?? GENESIS_HASH)) {
    return `Entry ${tail.seq} does not link to the hash of the entry before it.`;
  }
  const signed = await verifySignature(tail.signature);
  const payload = signed.payload as { seq?: unknown; hash?: unknown } | undefined;
  if (!signed.valid || payload?.seq !== tail.seq || payload?.hash !== tail.hash) {
    return `The signature on entry ${tail.seq} does not match it.`;
  }
  return undefined;
}
