import { resetDemo } from "@/lib/demo";
import { gateway } from "@/lib/gateway";
import { refuseAgents } from "@/lib/http/agent";
import { guardApprover } from "@/lib/http/console-session";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { seedIfEmpty } from "@/lib/seed";
import { currentWorkspace, sandboxes, templateStatus } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A sandbox goes back to its seeded copy at the visitor's word; the shared workspace needs the approver. */
export const POST = route(async (request) => {
  const workspace = currentWorkspace();
  if (workspace.kind === "sandbox") refuseAgents(request.headers);
  else await guardApprover(request.headers, "reset");
  await gateway().reset();
  resetDemo();
  if (workspace.kind === "sandbox") {
    await sandboxes().restore(workspace);
    return json({ ok: true, detail: "Your sandbox is back to a fresh copy of the demo week. Nobody else's changed.", seed: await templateStatus() });
  }
  const seed = await seedIfEmpty();
  const history = seed.state === "seeded" ? ` A week of demo history was written again (${seed.requests} requests).` : "";
  return json({ ok: true, detail: `Orders, audit log and activity were cleared.${history}`, seed });
});
