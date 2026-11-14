import { ForbiddenError } from "./agent";
import { sessionClaims } from "./session-token";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * A browser that switched to the shared workspace may read it. Changing it takes an approver or operator session
 * for the shared workspace, which only the passcode gives (demo access exists only in sandboxes).
 */
export async function refuseSharedWrite(request: Request): Promise<void> {
  if (READS.has(request.method)) return;
  const [approver, operator] = await Promise.all([sessionClaims(request.headers, "approver"), sessionClaims(request.headers, "operator")]);
  if (approver || operator) return;
  throw new ForbiddenError("The shared workspace is read-only for visitors. Switch back to your sandbox, or sign in with the passcode.", "shared_read_only");
}
