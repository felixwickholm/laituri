import { checkpoint } from "@/lib/audit";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The gateway exposes no checkpoint; the audit module signs it directly.
export const GET = route(async () => json(await checkpoint()));
