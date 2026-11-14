import { gateway } from "@/lib/gateway";
import { requireApprover } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import type { MandatePatch } from "@/lib/orders/types";
import { MandatePatchBody } from "@/lib/openapi/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async () => json(await gateway().getMandate()));

export const PUT = route(async (request) => {
  await requireApprover(request.headers);
  const patch = (await readBody(request, MandatePatchBody)) as MandatePatch;
  return json(await gateway().updateMandate(patch));
});
