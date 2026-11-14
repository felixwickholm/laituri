import type { RecipeSource } from "@/lib/contracts";

/**
 * Where a recipe comes from, when the library says. The recipe library may carry `source` as a URL or as
 * { name, url }, or a `sourceUrl`; a Valio source is credited "Recipe: Valio".
 */
export function recipeSource(recipe: object): RecipeSource | undefined {
  const loose = recipe as { source?: unknown; sourceUrl?: unknown; attribution?: unknown };
  let name: string | undefined;
  let url: string | undefined;
  if (typeof loose.source === "string") url = loose.source;
  else if (loose.source && typeof loose.source === "object") {
    const source = loose.source as { name?: unknown; url?: unknown; publisher?: unknown; attribution?: unknown };
    if (typeof source.attribution === "string" && typeof source.name === "string") {
      return { name: source.name, ...(typeof source.url === "string" ? { url: source.url } : {}), attribution: source.attribution };
    }
    name = typeof source.name === "string" ? source.name : typeof source.publisher === "string" ? source.publisher : undefined;
    url = typeof source.url === "string" ? source.url : undefined;
  }
  if (!url && typeof loose.sourceUrl === "string") url = loose.sourceUrl;
  if (!name && url && /valio/i.test(url)) name = "Valio";
  if (!name) return undefined;
  const attribution = typeof loose.attribution === "string" ? loose.attribution : `Recipe: ${name}`;
  return { name, ...(url ? { url } : {}), attribution };
}
