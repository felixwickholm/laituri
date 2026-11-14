import { TtlCache } from "./cache";
import { fetchRawAvailability, fetchRawPrices, type UpstreamConfig } from "./http";
import { normaliseAvailability, normalisePrice } from "./normalise";
import { unknownAvailability, unknownPrice } from "./raw";
import type { UpstreamAvailability, UpstreamClient, UpstreamPrice } from "./types";

const CACHE_TTL_MS = 60_000;

type Fetcher<T> = (ids: string[], date: string, customer: string) => Promise<T[]>;

/** Answers from the cache where possible and asks the API for the rest in one batched call. */
async function cached<T extends { productId: string }>(
  cache: TtlCache<T>,
  ids: string[],
  date: string,
  customer: string,
  fetchMissing: Fetcher<T>,
  fallback: (id: string) => T,
): Promise<Map<string, T>> {
  const key = (id: string) => `${date}|${customer}|${id}`;
  const result = new Map<string, T>();
  const missing: string[] = [];
  for (const id of new Set(ids)) {
    const hit = cache.get(key(id));
    if (hit) result.set(id, hit);
    else missing.push(id);
  }
  if (missing.length > 0) {
    const fetched = new Map((await fetchMissing(missing, date, customer)).map((item) => [item.productId, item]));
    for (const id of missing) {
      const value = fetched.get(id) ?? fallback(id);
      cache.set(key(id), value);
      result.set(id, value);
    }
  }
  return result;
}

export class LiveUpstream implements UpstreamClient {
  private readonly prices = new TtlCache<UpstreamPrice>(CACHE_TTL_MS);
  private readonly stock = new TtlCache<UpstreamAvailability>(CACHE_TTL_MS);

  constructor(private readonly config: UpstreamConfig) {}

  price(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamPrice>> {
    return cached(
      this.prices,
      productIds,
      date,
      customer,
      async (ids, d, c) => (await fetchRawPrices(this.config, ids, d, c)).map(normalisePrice),
      (id) => normalisePrice(unknownPrice(id)),
    );
  }

  availability(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamAvailability>> {
    return cached(
      this.stock,
      productIds,
      date,
      customer,
      async (ids, d, c) => (await fetchRawAvailability(this.config, ids, d, c)).map(normaliseAvailability),
      (id) => normaliseAvailability(unknownAvailability(id)),
    );
  }
}
