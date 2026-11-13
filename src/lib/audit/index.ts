import type { AuditVerification } from "@/lib/contracts";
import { store } from "@/lib/store";
import { trust } from "@/lib/trust";
import { verifyChain } from "./verify";

export { appendAudit, type AuditInput } from "./chain";
export { checkpoint, type Checkpoint } from "./checkpoint";
export { GENESIS_HASH, entryHash, hashedPart, verifyChain, type SignatureVerifier } from "./verify";

/** Verifies the stored log with the supplier key. */
export async function verifyAuditLog(): Promise<AuditVerification> {
  const entries = await store().audit.list();
  return verifyChain(entries, (jws) => trust().verify("supplier", jws));
}
