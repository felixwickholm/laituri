import { ApprovalDecisionRequest } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { deciderOf, guardApprover } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request, params) => {
  const session = await guardApprover(request.headers, "approve", { orderId: params.orderId });
  const body = await readBody(request, ApprovalDecisionRequest);
  return json(await gateway().decideApproval(params.orderId, body, deciderOf(session)));
});
