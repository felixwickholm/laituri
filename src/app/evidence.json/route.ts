import { publicJson } from "@/lib/discovery/respond";
import { evidence } from "@/lib/evidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The data behind /evidence and the README's criteria table, machine-readable. */
export const GET = () => publicJson(evidence());
