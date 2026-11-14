import { readerBuyer } from "@/lib/http/buyer-scope";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { suggestionsFor } from "@/lib/suggestions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** What the buyer's agent proposes before anyone asks: at most six, ranked. */
export const GET = route(async (request) => json({ suggestions: await suggestionsFor(await readerBuyer(request, "suggestions")) }));
