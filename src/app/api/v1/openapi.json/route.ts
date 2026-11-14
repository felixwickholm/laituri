import { route } from "@/lib/http/handler";
import { originOf } from "@/lib/http/origin";
import { json } from "@/lib/http/respond";
import { openApiDocument } from "@/lib/openapi/document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request) =>
  json(openApiDocument(originOf(request)), { headers: { "access-control-allow-origin": "*" } }),
);
