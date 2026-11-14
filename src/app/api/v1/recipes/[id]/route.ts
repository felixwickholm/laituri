import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { getRecipe } from "@/lib/recipes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (_request, params) => json(getRecipe(params.id)));
