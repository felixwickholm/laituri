import { refuseAgents } from "@/lib/http/agent";
import { clientAddress } from "@/lib/http/client-address";
import { route } from "@/lib/http/handler";
import { originOf } from "@/lib/http/origin";
import { json, problem } from "@/lib/http/respond";
import { describeWorkspace } from "@/lib/http/workspace-info";
import { currentWorkspace, sandboxCreationLimit, sandboxes } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The browser's workspace and its agent keys. Agent credentials are refused, so a key never leads to the browser's cookie. */
export const GET = route(async (request) => {
  refuseAgents(request.headers);
  return json(await describeWorkspace(currentWorkspace(), originOf(request)));
});

/**
 * A private sandbox for a client without a browser (curl, an agent's own code): its agent keys and MCP address, and no
 * cookie, so the keys are the only way in. Each client address may make a few per ten minutes.
 */
export const POST = route(async (request) => {
  refuseAgents(request.headers);
  const admission = sandboxCreationLimit().admit(clientAddress(request.headers));
  if (!admission.allowed) {
    const response = problem(429, "too_many_sandboxes", `This address made several sandboxes in the last ten minutes. Use one of their keys, or try again in ${admission.retryAfterS} seconds.`);
    response.headers.set("retry-after", String(admission.retryAfterS));
    return response;
  }
  return json(await describeWorkspace(await sandboxes().forClient(), originOf(request)), { status: 201 });
});
