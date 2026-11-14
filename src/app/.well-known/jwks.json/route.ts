import { publicKeySet } from "@/lib/discovery/jwks";
import { publicJson } from "@/lib/discovery/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async () => publicJson(await publicKeySet());
