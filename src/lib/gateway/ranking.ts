import type { SearchHit, SearchPreference } from "@/lib/contracts";

/** Labels that certify how a product was produced, as opposed to where it comes from. */
const SUSTAINABILITY_LABELS = new Set(["organic", "eu_ecolabel", "eco_label", "nordic_swan", "msc", "asc", "fairtrade", "rainforest_alliance"]);

type Key = (hit: SearchHit) => number;

const orderable: Key = (hit) => (hit.offerPreview?.orderable ? 0 : 1);
const pricePerUnit: Key = (hit) => hit.offerPreview?.comparisonPrice?.amount ?? Number.POSITIVE_INFINITY;
const unreliability: Key = (hit) => 1 - (hit.facts.deliveryReliability ?? 0);
const uncertified: Key = (hit) => -hit.facts.labels.filter((label) => SUSTAINABILITY_LABELS.has(label)).length;
const categoryCarbon: Key = (hit) => hit.facts.categoryAverageCo2PerKg ?? Number.POSITIVE_INFINITY;

/** Lower first. Every preference falls back to the price, so equal products still come cheapest first. */
const KEYS: Record<SearchPreference, Key[]> = {
  price: [pricePerUnit],
  reliability: [unreliability, pricePerUnit],
  sustainability: [uncertified, categoryCarbon, pricePerUnit],
};

/**
 * When every hit is the product asked for, the first hit is the one to buy: orderable on time first, then by the
 * buyer's preference. The search order breaks ties, so equal hits keep their relevance order.
 */
export function bestBuyFirst(hits: SearchHit[], prefer: SearchPreference = "price"): SearchHit[] {
  const keys = [orderable, ...KEYS[prefer]];
  const compare = (a: SearchHit, b: SearchHit) => keys.reduce((order, key) => order || key(a) - key(b), 0);
  return hits
    .map((hit, index) => ({ hit, index }))
    .sort((a, b) => compare(a.hit, b.hit) || a.index - b.index)
    .map(({ hit }) => hit);
}
