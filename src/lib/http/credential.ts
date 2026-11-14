import { currentWorkspace } from "@/lib/workspace/context";
import { bearerToken, tokenBuyer } from "./agent";
import { sessionClaims } from "./session-token";

/**
 * Whether the caller showed something this workspace knows: an agent key of its own, the sandbox's cookie (a sandbox
 * is reached no other way) or a session signed for this workspace. Refusals are logged only for such callers, so a
 * caller with nothing cannot fill the audit log.
 */
export async function presentedCredential(headers: Headers): Promise<boolean> {
  const token = bearerToken(headers);
  if (token) return tokenBuyer(token) !== undefined;
  if (currentWorkspace().kind === "sandbox") return true;
  const [approver, operator] = await Promise.all([sessionClaims(headers, "approver"), sessionClaims(headers, "operator")]);
  return Boolean(approver || operator);
}
