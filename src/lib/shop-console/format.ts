import type { OfferPreview, Product, ProductFacts, SearchPreference } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { priceUnit } from "@/lib/console/format/packs";
import { day, hourMinute } from "@/lib/console/format/time";

/** A category chip: the API's category group, a plain name, and the word searched when the field is empty. */
export interface Category {
  group: string;
  label: string;
  starter: string;
}

export const CATEGORIES: Category[] = [
  { group: "dairy", label: "Dairy", starter: "milk" },
  { group: "cheese", label: "Cheese", starter: "cheese" },
  { group: "bakery", label: "Bakery", starter: "bread" },
  { group: "produce", label: "Fruit and veg", starter: "potato" },
  { group: "dry_goods", label: "Dry goods", starter: "pasta" },
  { group: "beverages", label: "Drinks", starter: "juice" },
  { group: "eggs", label: "Eggs", starter: "egg" },
  { group: "plant_based", label: "Plant-based", starter: "oat drink" },
];

export const PREFERENCES: { id: SearchPreference; label: string; sentence: string }[] = [
  { id: "price", label: "Price", sentence: "Lowest price per litre or kilo first." },
  { id: "reliability", label: "On time", sentence: "Most reliable deliveries first." },
  { id: "sustainability", label: "Labels", sentence: "Certified labels first, then lower CO₂." },
];

/** What one sales unit holds: "12 × 1 l", "1 l", "5 kg", "6 pieces". */
export function packLabel(product: Pick<Product, "salesUnit" | "units" | "content">): string {
  const size = product.units.find((unit) => unit.unit === product.salesUnit)?.sizeInBaseUnits ?? 1;
  const { content } = product;
  if (product.salesUnit === "KG") return "Sold by the kilo";
  if (content && size > 1) return `${count(size)} × ${count(Math.round((content.amount / size) * 1000) / 1000)} ${content.unit}`;
  if (content) return `${count(content.amount)} ${content.unit}`;
  return size > 1 ? `${count(size)} pieces` : "1 piece";
}

/** "€12.40 each", "€38.00 per case", "€4.20 per kg". */
export function unitPriceText(preview: Pick<OfferPreview, "unitPrice">, salesUnit: string): string {
  return `${eur(preview.unitPrice.amount)} ${priceUnit({ salesUnit })}`;
}

/** "€1.03 / l", or nothing when the API gives no comparison price. */
export function comparisonText(preview: Pick<OfferPreview, "comparisonPrice">): string | undefined {
  const compare = preview.comparisonPrice;
  return compare ? `${eur(compare.amount)} / ${compare.per}` : undefined;
}

export type Tone = "success" | "waiting" | "danger" | "neutral";

/** Below this many sales units the count is shown instead of "In stock". */
const LOW_STOCK = 100;

/** Stock in a word or two, with a tone: "In stock", "51 left", "Stock not counted", "Out of stock". */
export function availabilityText(preview: Pick<OfferPreview, "availability"> | undefined): { word: string; tone: Tone } {
  if (!preview) return { word: "No live price", tone: "neutral" };
  const { status, available } = preview.availability;
  if (status === "unavailable") return { word: "Out of stock", tone: "danger" };
  if (status === "blocked") return { word: "Not for sale now", tone: "danger" };
  if (status === "cutoff_passed") return { word: "Next delivery day", tone: "waiting" };
  if (available === undefined) return { word: "Stock not counted", tone: "neutral" };
  if (status === "partial" || available < LOW_STOCK) return { word: `${count(available)} left`, tone: "waiting" };
  return { word: "In stock", tone: "success" };
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", weekday: "short" });

/** "Arrives Mon 16 Nov. Order by Sun 17:00." Either half is left out when the API does not give it. */
export function deliveryText(preview: Pick<OfferPreview, "availability"> | undefined): string | undefined {
  const { deliveryDate, orderBy } = preview?.availability ?? {};
  const parts: string[] = [];
  if (deliveryDate) parts.push(`Arrives ${day(deliveryDate)}.`);
  // An order time already gone says nothing useful next to the day it arrives.
  if (orderBy && !Number.isNaN(Date.parse(orderBy)) && Date.parse(orderBy) > Date.now()) parts.push(`Order by ${WEEKDAY.format(new Date(orderBy))} ${hourMinute(orderBy)}.`);
  return parts.length ? parts.join(" ") : undefined;
}

const LABEL_WORDS: Record<string, string> = {
  finnish_origin: "Finnish origin",
  made_in_finland: "Made in Finland",
  organic: "Organic",
  msc: "MSC",
  asc: "ASC",
  fairtrade: "Fairtrade",
  rainforest_alliance: "Rainforest Alliance",
  nordic_swan: "Nordic Swan",
  eu_ecolabel: "EU Ecolabel",
  heart_symbol: "Heart symbol",
  lactose_free: "Lactose-free",
  low_lactose: "Low lactose",
  gluten_free: "Gluten-free",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
};

/** The labels and claims a kitchen cares about, in plain words, without repeats. */
export function labelChips(product: Pick<Product, "claims" | "labels">, facts?: Pick<ProductFacts, "labels">): string[] {
  const ids = [...(facts?.labels ?? product.labels), ...product.claims];
  return [...new Set(ids.map((id) => LABEL_WORDS[id]).filter((word): word is string => Boolean(word)))];
}

/** "97% of deliveries arrived in full and on time." */
export function reliabilityText(share: number | undefined): string | undefined {
  if (share === undefined) return undefined;
  return `${Math.round(share * 100)}% of deliveries arrived in full and on time.`;
}

/** "1.1 kg CO₂e per kg." The caller says it is a category average. */
export function co2Text(perKg: number | undefined): string | undefined {
  return perKg === undefined ? undefined : `${count(perKg)} kg CO₂e per kg`;
}

const ALLERGEN_WORDS: Record<string, string> = { nuts: "tree nuts", molluscs: "molluscs", crustaceans: "crustaceans" };

function list(ids: string[]): string {
  const words = ids.map((id) => ALLERGEN_WORDS[id] ?? id.replace(/_/g, " "));
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0];
}

/** Allergens in plain sentences. No data at all is said honestly. */
export function allergenSentences(allergens: Product["allergens"]): string[] {
  const { contains, mayContain, freeFrom } = allergens;
  if (!contains.length && !mayContain.length && !freeFrom.length) return ["No allergen data."];
  const out: string[] = [];
  if (contains.length) out.push(`Contains ${list(contains)}.`);
  if (mayContain.length) out.push(`May contain ${list(mayContain)}.`);
  if (!contains.length && !mayContain.length) out.push("No listed allergens.");
  return out;
}

const COUNTRIES = new Intl.DisplayNames(["en"], { type: "region" });

/** "FI" -> "Finland". */
export function countryName(code: string | undefined): string | undefined {
  if (!code) return undefined;
  try {
    return COUNTRIES.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
