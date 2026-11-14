import { aiCatalog } from "@/lib/discovery/documents";
import { publicJson } from "@/lib/discovery/respond";
import { route } from "@/lib/http/handler";
import { originOf } from "@/lib/http/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request) => publicJson(aiCatalog(originOf(request))));
