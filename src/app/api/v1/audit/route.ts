import { gateway } from "@/lib/gateway";
import { intParam, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request) => {
  const after = intParam(new URL(request.url), "after");
  return json({ entries: await gateway().auditLog(after) });
});
