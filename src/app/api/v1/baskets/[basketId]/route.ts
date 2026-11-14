import { getBasket } from "@/lib/basket";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request, params) => json(await getBasket(params.basketId, await readerBuyer(request, "baskets"))));
