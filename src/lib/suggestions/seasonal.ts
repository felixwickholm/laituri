import type { Mandate, Product } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import { dietRules, productSafe } from "@/lib/menu/dietary";

/**
 * What the wholesaler promotes in which months. Our assumption: the product data carries no season or launch flag,
 * so the selling agent works from this short list and from what the kitchen already buys.
 */
const SEASONAL: { months: number[]; query: string; nameHas: string; label: string; reason: string }[] = [
  { months: [11, 12], query: "barista oat drink", nameHas: "gingerbread", label: "gingerbread oat drink", reason: "for Christmas coffee" },
  { months: [11, 12, 1], query: "smetana", nameHas: "smetana", label: "smetana", reason: "for winter soups and blinis" },
  { months: [5, 6, 7], query: "early potatoes", nameHas: "early", label: "new potatoes", reason: "while the season lasts" },
  { months: [8, 9, 10], query: "pike-perch fillet", nameHas: "pike", label: "Finnish pike-perch", reason: "for autumn menus" },
];

export interface SeasonalPick {
  product: Product;
  label: string;
  reason: string;
}

/**
 * The first product in season that the buyer's mandate allows (allergens and categories) and that is in a category
 * group the kitchen has bought from; the mandate's categories stand in when it has not bought yet.
 */
export function seasonalPick(catalog: Pick<Catalog, "search">, mandate: Mandate, boughtGroups: string[], month: number): SeasonalPick | undefined {
  const rules = dietRules([], mandate);
  const groups = boughtGroups.length ? boughtGroups : mandate.categories.allowed;
  for (const entry of SEASONAL.filter((candidate) => candidate.months.includes(month))) {
    const product = catalog
      .search({ query: entry.query, limit: 20 })
      .hits.map((hit) => hit.product)
      .find(
        (candidate) =>
          candidate.name.en.toLowerCase().includes(entry.nameHas) &&
          productSafe(candidate.allergens, rules) &&
          mandate.categories.allowed.includes(candidate.categoryGroup) &&
          groups.includes(candidate.categoryGroup),
      );
    if (product) return { product, label: entry.label, reason: entry.reason };
  }
  return undefined;
}
