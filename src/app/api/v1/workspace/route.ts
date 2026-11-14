import { refuseAgents } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { originOf } from "@/lib/http/origin";
import { json } from "@/lib/http/respond";
import { describeWorkspace } from "@/lib/http/workspace-info";
import { currentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The browser's workspace and its agent keys. Agent credentials are refused, so a key never leads to the browser's cookie. */
export const GET = route(async (request) => {
  refuseAgents(request.headers);
  return json(await describeWorkspace(currentWorkspace(), originOf(request)));
});
