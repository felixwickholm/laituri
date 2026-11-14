import { ResolveLineRequest } from "@/lib/contracts";
import { resolveLine } from "@/lib/basket";
import { guardApprover } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A person takes one option on an orange or red line. Agents are refused, and the attempt is logged. */
export const POST = route(async (request, params) => {
  const session = await guardApprover(request.headers, "approve");
  const { optionId } = await readBody(request, ResolveLineRequest);
  return json(await resolveLine(params.basketId, params.lineId, optionId, session));
});
