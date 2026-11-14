import { publicJson } from "@/lib/discovery/respond";
import { evidence } from "@/lib/evidence";
import { route } from "@/lib/http/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The data behind /evidence and the README's criteria table, machine-readable. */
export const GET = route(async () => publicJson(evidence()));
