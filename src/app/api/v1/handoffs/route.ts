import { CreateHandoffRequest } from "@/lib/contracts";
import { createHandoff, listHandoffs } from "@/lib/handoffs";
import { refuseAgents } from "@/lib/http/agent";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { guardApprover } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { operatorSession } from "@/lib/http/operator-session";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The signed-in approver asks a person at Valio Aimo. */
export const POST = route(async (request) => {
  const session = await guardApprover(request.headers, "handoff");
  const body = await readBody(request, CreateHandoffRequest);
  return json(await createHandoff(body, session), { status: 201 });
});

/** The operator sees every hand-off in the workspace; a buyer's reader sees that buyer's. Agent keys are refused. */
export const GET = route(async (request) => {
  refuseAgents(request.headers);
  const operator = await operatorSession(request.headers);
  if (operator.signedIn) return json({ handoffs: await listHandoffs() });
  return json({ handoffs: await listHandoffs(await readerBuyer(request, "hand-offs")) });
});
