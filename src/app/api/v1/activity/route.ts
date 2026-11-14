import { gateway } from "@/lib/gateway";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request) => {
  const after = new URL(request.url).searchParams.get("after") || undefined;
  return json({ activity: await gateway().activity(after) });
});
