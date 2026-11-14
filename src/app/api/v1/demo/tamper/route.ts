import { restoreAudit, tamperAudit } from "@/lib/demo";
import { refuseAgents } from "@/lib/http/agent";
import { guardApprover } from "@/lib/http/console-session";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { currentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Altering the log pauses approvals for everyone in the workspace, so the shared one needs the approver. */
async function guardTamper(headers: Headers): Promise<void> {
  if (currentWorkspace().kind === "sandbox") refuseAgents(headers);
  else await guardApprover(headers, "tamper");
}

export const POST = route(async (request) => {
  await guardTamper(request.headers);
  const { seq } = await tamperAudit();
  return json({ seq, tampered: true });
});

export const DELETE = route(async (request) => {
  await guardTamper(request.headers);
  await restoreAudit();
  return json({ restored: true });
});
