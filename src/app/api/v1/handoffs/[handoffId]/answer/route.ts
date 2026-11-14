import { HandoffAnswerRequest } from "@/lib/contracts";
import { answerHandoff } from "@/lib/handoffs";
import { guardHandoffOperator } from "@/lib/handoffs/guard";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A signed-in Valio Aimo operator answers a kitchen. */
export const POST = route(async (request, params) => {
  const operator = await guardHandoffOperator(request.headers, params.handoffId);
  const { words } = await readBody(request, HandoffAnswerRequest);
  return json(await answerHandoff(params.handoffId, words, operator));
});
