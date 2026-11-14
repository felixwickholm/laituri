import { now } from "@/lib/clock";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { catalogStatus } from "@/lib/http/health";
import { ping } from "@/lib/valio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async () => {
  const upstream = await ping();
  const catalog = catalogStatus();
  return json({
    status: upstream.ok && catalog.ready ? "ok" : "degraded",
    mode: upstream.mode,
    upstream: { ok: upstream.ok, latencyMs: upstream.latencyMs, error: upstream.error },
    catalog,
    time: now().toISOString(),
  });
});
