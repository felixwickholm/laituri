import { getRun } from "@/lib/demo";
import { NotFoundError } from "@/lib/gateway/errors";
import { refuseAgents } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { requireReader } from "@/lib/http/reader";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request, params) => {
  refuseAgents(request.headers);
  await requireReader(request, "a demo run");
  const run = getRun(params.runId);
  if (!run) throw new NotFoundError(`Run ${params.runId} is not known.`);
  return json(run);
});
