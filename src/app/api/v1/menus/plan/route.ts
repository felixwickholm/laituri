import { MenuPlanRequest } from "@/lib/contracts";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { planMenuFor } from "@/lib/menu/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Need -> recipe -> order: three menus for an event, under the calling agent's buyer's mandate. */
export const POST = route(async (request) => {
  const buyerId = await readerBuyer(request, "menus");
  const body = await readBody(request, MenuPlanRequest);
  return json(await planMenuFor(buyerId, body));
});
