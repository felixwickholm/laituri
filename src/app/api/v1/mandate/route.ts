import { gateway } from "@/lib/gateway";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { deciderOf, guardApprover } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import type { MandatePatch } from "@/lib/orders/types";
import { MandatePatchBody } from "@/lib/openapi/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request) => json(await gateway().getMandate(await readerBuyer(request, "the mandate"))));

export const PUT = route(async (request) => {
  const session = await guardApprover(request.headers, "mandate");
  const patch = (await readBody(request, MandatePatchBody)) as MandatePatch;
  return json(await gateway().updateMandate(patch, deciderOf(session)));
});
