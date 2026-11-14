import { activeEngine } from "@/lib/agent/llm";
import { now } from "@/lib/clock";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { catalogStatus } from "@/lib/http/health";
import { seedStatus } from "@/lib/seed";
import { storeStatus } from "@/lib/store";
import { ping, upstreamUsage } from "@/lib/valio";
import { sandboxes, templateStatus } from "@/lib/workspace";
import { sandboxLimits } from "@/lib/workspace/limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async () => {
  const upstream = await ping();
  const catalog = catalogStatus();
  const saved = storeStatus();
  const limits = sandboxLimits();
  const usage = upstreamUsage();
  const healthy = upstream.ok && catalog.ready && !saved.recovery && !saved.lastSaveError;
  return json({
    status: healthy ? "ok" : "degraded",
    mode: upstream.mode,
    upstream: { ok: upstream.ok, latencyMs: upstream.latencyMs, error: upstream.error, ...usage.workspace, total: usage.total, catalogueSize: catalog.size },
    catalog,
    seed: seedStatus(),
    agent: activeEngine(),
    sandboxes: {
      active: sandboxes().active(),
      max: limits.max,
      idleMinutes: limits.idleMs / 60_000,
      template: await templateStatus(),
    },
    store: saved,
    time: now().toISOString(),
  });
});
