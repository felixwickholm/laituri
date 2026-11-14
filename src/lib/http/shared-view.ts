import { ForbiddenError } from "./agent";
import { CredentialRequiredError } from "./reader";
import { sessionClaims } from "./session-token";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * A browser that switched to the shared workspace, or a caller with no credential, may read it. Changing it takes an
 * approver or operator session for the shared workspace, which only the passcode gives (demo access exists only in
 * sandboxes). A caller with no credential is told how to get one.
 */
export async function refuseSharedWrite(request: Request, access: "shared-view" | "anonymous" = "shared-view"): Promise<void> {
  if (READS.has(request.method)) return;
  const [approver, operator] = await Promise.all([sessionClaims(request.headers, "approver"), sessionClaims(request.headers, "operator")]);
  if (approver || operator) return;
  if (access === "anonymous") throw new CredentialRequiredError("or changing the shared workspace");
  throw new ForbiddenError("The shared workspace is read-only for visitors. Switch back to your sandbox, or sign in with the passcode.", "shared_read_only");
}
