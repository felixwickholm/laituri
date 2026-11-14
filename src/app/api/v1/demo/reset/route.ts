import { resetDemo } from "@/lib/demo";
import { gateway } from "@/lib/gateway";
import { guardApprover } from "@/lib/http/console-session";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request) => {
  await guardApprover(request.headers, "reset");
  await gateway().reset();
  resetDemo();
  return json({ ok: true, detail: "Orders, audit log and activity were cleared." });
});
