import { RecipeSearch } from "@/lib/contracts";
import { ValidationError } from "@/lib/gateway/errors";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { listRecipes, searchRecipes } from "@/lib/recipes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The query as a search: ?words=&occasion=&course=&dietary=nut_free,gluten_free&plannable=true&limit=. */
function searchOf(params: URLSearchParams): RecipeSearch | undefined {
  const keys = ["words", "occasion", "course", "dietary", "plannable", "limit"];
  if (!keys.some((key) => params.has(key))) return undefined;
  const parsed = RecipeSearch.safeParse({
    words: params.get("words") ?? undefined,
    occasion: params.get("occasion") ?? undefined,
    course: params.get("course") ?? undefined,
    dietary: params.get("dietary")?.split(",").map((need) => need.trim()).filter(Boolean),
    plannable: params.has("plannable") ? params.get("plannable") === "true" : undefined,
    limit: params.has("limit") ? Number(params.get("limit")) : undefined,
  });
  if (!parsed.success) throw new ValidationError("Check the search: course is starter, main, side, dessert or drink; limit is 1 to 200.");
  return parsed.data;
}

/** The recipe library is public: it holds no buyer's data. Valio's recipes come first, our own after as a fallback. */
export const GET = route(async (request) => {
  const search = searchOf(new URL(request.url).searchParams);
  return json({ recipes: search ? searchRecipes(search) : listRecipes() });
});
