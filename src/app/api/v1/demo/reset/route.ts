import { gateway } from "@/lib/gateway";
import { refuseAgents } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request) => {
  refuseAgents(request.headers);
  await gateway().reset();
  return json({ ok: true, detail: "Orders, audit log and activity were cleared." });
});
