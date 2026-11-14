import { llmsText } from "@/lib/discovery/llms";
import { route } from "@/lib/http/handler";
import { originOf } from "@/lib/http/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request) =>
  new Response(llmsText(originOf(request)), {
    headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" },
  }),
);
