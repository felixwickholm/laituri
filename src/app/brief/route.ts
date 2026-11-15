import { readFile } from "node:fs/promises";
import path from "node:path";
import { route } from "@/lib/http/handler";

export const dynamic = "force-static";
export const runtime = "nodejs";

/** The brief as a page. Built from docs/brief by scripts/brief.ts into public/brief.html; the PDF is public/brief.pdf. */
export const GET = route(async () =>
  new Response(await readFile(path.join(process.cwd(), "public", "brief.html"), "utf8"), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
  }),
);
