import { entriesForBuyer } from "@/lib/audit";
import { gateway } from "@/lib/gateway";
import { intParam, route } from "@/lib/http/handler";
import { requireReader } from "@/lib/http/reader";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A browser in its sandbox or a signed-in person reads every entry; an agent its own buyer's, and stubs of the rest. */
export const GET = route(async (request) => {
  const reader = await requireReader(request, "the audit log");
  const entries = await gateway().auditLog(intParam(new URL(request.url), "after"));
  return json({ entries: reader.kind === "agent" ? entriesForBuyer(entries, reader.buyerId) : entries });
});
