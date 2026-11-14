import { WorkspaceViewRequest } from "@/lib/contracts";
import { refuseAgents } from "@/lib/http/agent";
import { readBody, route } from "@/lib/http/handler";
import { originOf } from "@/lib/http/origin";
import { json } from "@/lib/http/respond";
import { sandboxForSecret } from "@/lib/http/workspace";
import { describeWorkspace } from "@/lib/http/workspace-info";
import { sharedWorkspace } from "@/lib/workspace";
import {
  VIEW_COOKIE,
  WORKSPACE_COOKIE,
  WORKSPACE_COOKIE_MAX_AGE_S,
  cookieHeader,
  cookieValue,
  isWorkspaceSecret,
  newWorkspaceSecret,
} from "@/lib/workspace/cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lets the browser look at the shared workspace instead of its sandbox, read-only unless signed in with the
 * passcode, and back again. Its sandbox is kept meanwhile.
 */
export const POST = route(async (request) => {
  refuseAgents(request.headers);
  const { view } = await readBody(request, WorkspaceViewRequest);
  const headers = new Headers();
  if (view === "shared") {
    headers.append("set-cookie", cookieHeader(VIEW_COOKIE, "shared", { maxAge: WORKSPACE_COOKIE_MAX_AGE_S, sameSite: "Lax" }));
    return json(await describeWorkspace(sharedWorkspace(), originOf(request)), { headers });
  }
  headers.append("set-cookie", cookieHeader(VIEW_COOKIE, "", { maxAge: 0, sameSite: "Lax" }));
  let secret = cookieValue(request.headers, WORKSPACE_COOKIE);
  if (!isWorkspaceSecret(secret)) {
    secret = newWorkspaceSecret();
    headers.append("set-cookie", cookieHeader(WORKSPACE_COOKIE, secret, { maxAge: WORKSPACE_COOKIE_MAX_AGE_S, sameSite: "Lax" }));
  }
  return json(await describeWorkspace(await sandboxForSecret(secret, request.headers), originOf(request)), { headers });
}, { openInSharedView: true });
