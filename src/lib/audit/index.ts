import type { AuditVerification } from "@/lib/contracts";
import { store } from "@/lib/store";
import { TOKEN_TYPE, trust } from "@/lib/trust";
import { knownHead } from "./head";
import { verifyChain } from "./verify";

export { appendAudit, type AuditInput } from "./chain";
export { checkpoint, type Checkpoint } from "./checkpoint";
export { forgetHead } from "./head";
export { GENESIS_HASH, entryHash, hashedPart, verifyChain, type LogHead, type SignatureVerifier } from "./verify";

/** Verifies the stored log with the supplier key, and that it still reaches the last recorded head. */
export async function verifyAuditLog(): Promise<AuditVerification> {
  const entries = await store().audit.list();
  return verifyChain(entries, (jws) => trust().verify("supplier", jws, TOKEN_TYPE.audit), knownHead());
}
