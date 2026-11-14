import type { AuditVerification } from "@/lib/contracts";
import { store } from "@/lib/store";
import { TOKEN_TYPE, trust, type Verified } from "@/lib/trust";
import { workspaceState } from "@/lib/workspace/context";
import { knownHead } from "./head";
import { verifyChain } from "./verify";

export { appendAudit, type AuditInput } from "./chain";
export { checkpoint, type Checkpoint } from "./checkpoint";
export { forgetHead } from "./head";
export {
  GENESIS_HASH,
  contentDigest,
  entriesForBuyer,
  entryHash,
  hashMatches,
  isStub,
  legacyEntryHash,
  redactEntry,
  verifyChain,
  type LogHead,
  type SignatureVerifier,
} from "./verify";

/**
 * Signatures already checked, by compact JWS. A signature's validity depends only on its bytes and the key, so a
 * full verify, run before every order, checks only the new ones; hashes and links are still recomputed every time.
 */
const checkedSignatures = workspaceState("audit.signatures", () => new Map<string, Verified<unknown>>());

async function verifySignature(jws: string): Promise<Verified<unknown>> {
  const checked = checkedSignatures();
  const known = checked.get(jws);
  if (known) return known;
  const result = await trust().verify<unknown>("supplier", jws, TOKEN_TYPE.audit);
  checked.set(jws, result);
  return result;
}

/** Verifies the stored log with the supplier key, and that it still reaches the last recorded head. */
export async function verifyAuditLog(): Promise<AuditVerification> {
  const entries = await store().audit.list();
  return verifyChain(entries, verifySignature, knownHead());
}
