import { ApprovalDecisionRequest } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { deciderOf, guardApprover } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { approvalResponse } from "@/lib/http/order-response";
import { stockWasTaken } from "@/lib/orders/stock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request, params) => {
  const session = await guardApprover(request.headers, "approve", { orderId: params.orderId });
  const body = await readBody(request, ApprovalDecisionRequest);
  const order = await gateway().decideApproval(params.orderId, body, deciderOf(session));
  const alternatives = stockWasTaken(order) ? (await gateway().requote(order)).alternatives : [];
  return approvalResponse(order, alternatives);
});
