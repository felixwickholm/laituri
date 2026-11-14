import { readerBuyer } from "@/lib/http/buyer-scope";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { pantryFor } from "@/lib/pantry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The kitchen's stock (demo data), for the caller's buyer. */
export const GET = route(async (request) => json({ items: pantryFor(await readerBuyer(request, "the kitchen stock")) }));
