import { publicKeySet } from "@/lib/discovery/jwks";
import { publicJson } from "@/lib/discovery/respond";
import { route } from "@/lib/http/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async () => publicJson(await publicKeySet()));
