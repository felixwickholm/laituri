import { TooManyRequestsError } from "@/lib/gateway/errors";
import { browserSandboxCreationLimit, sandboxes } from "@/lib/workspace";
import { sharedWorkspace, type Workspace } from "@/lib/workspace/context";
import { VIEW_COOKIE, WORKSPACE_COOKIE, cookieValue, isWorkspaceSecret } from "@/lib/workspace/cookie";
import { bearerToken } from "./agent";
import { clientAddress } from "./client-address";

/**
 * How the caller reached its workspace. "agent": a bearer credential (a sandbox key, else the shared workspace).
 * "browser": the workspace cookie. "shared-view": a browser looking at the shared workspace. "anonymous": neither.
 */
export type WorkspaceAccess = "agent" | "browser" | "shared-view" | "anonymous";

export interface ResolvedWorkspace {
  workspace: Workspace;
  access: WorkspaceAccess;
}

/**
 * The sandbox an issued browser secret names. Making a new one counts against the browser allowance of the caller's
 * address, so a script that collects cookies cannot fill the server; when every sandbox is in use the answer is 503.
 */
export function sandboxForSecret(secret: string, headers: Headers): Promise<Workspace> {
  return sandboxes().forSecret(secret, () => {
    const admission = browserSandboxCreationLimit().admit(clientAddress(headers));
    if (!admission.allowed) {
      throw new TooManyRequestsError(
        `Browsers at this address started many sandboxes in the last ten minutes. Try again in ${admission.retryAfterS} seconds.`,
        admission.retryAfterS,
        "too_many_sandboxes",
      );
    }
  });
}

/**
 * The workspace a request acts in. A sandbox agent key wins over any cookie, so calls a visitor's agent makes from
 * Claude or ChatGPT land on that visitor's screens. Only a cookie value this server issued reaches a sandbox; without a
 * credential or such a cookie (curl, the documented flows) a call reaches the shared workspace.
 */
export async function resolveWorkspace(headers: Headers): Promise<ResolvedWorkspace> {
  const token = bearerToken(headers);
  if (token) return { workspace: sandboxes().byAgentKey(token)?.workspace ?? sharedWorkspace(), access: "agent" };
  if (cookieValue(headers, VIEW_COOKIE) === "shared") return { workspace: sharedWorkspace(), access: "shared-view" };
  const secret = cookieValue(headers, WORKSPACE_COOKIE);
  if (isWorkspaceSecret(secret)) return { workspace: await sandboxForSecret(secret, headers), access: "browser" };
  return { workspace: sharedWorkspace(), access: "anonymous" };
}
