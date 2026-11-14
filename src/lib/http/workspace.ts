import { sandboxes } from "@/lib/workspace";
import { sharedWorkspace, type Workspace } from "@/lib/workspace/context";
import { VIEW_COOKIE, WORKSPACE_COOKIE, cookieValue, isWorkspaceSecret } from "@/lib/workspace/cookie";
import { bearerToken } from "./agent";

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
 * The workspace a request acts in. A sandbox agent key wins over any cookie, so calls a visitor's agent makes from
 * Claude or ChatGPT land on that visitor's screens. Without a credential or cookie (curl, the documented flows)
 * a call reaches the shared workspace.
 */
export async function resolveWorkspace(headers: Headers): Promise<ResolvedWorkspace> {
  const token = bearerToken(headers);
  if (token) return { workspace: sandboxes().byAgentKey(token)?.workspace ?? sharedWorkspace(), access: "agent" };
  if (cookieValue(headers, VIEW_COOKIE) === "shared") return { workspace: sharedWorkspace(), access: "shared-view" };
  const secret = cookieValue(headers, WORKSPACE_COOKIE);
  if (isWorkspaceSecret(secret)) return { workspace: await sandboxes().forSecret(secret), access: "browser" };
  return { workspace: sharedWorkspace(), access: "anonymous" };
}
