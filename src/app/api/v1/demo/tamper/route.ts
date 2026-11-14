import { restoreAudit, tamperAudit } from "@/lib/demo";
import { refuseAgents } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request) => {
  refuseAgents(request.headers);
  const { seq } = await tamperAudit();
  return json({ seq, tampered: true });
});

export const DELETE = route(async (request) => {
  refuseAgents(request.headers);
  await restoreAudit();
  return json({ restored: true });
});
