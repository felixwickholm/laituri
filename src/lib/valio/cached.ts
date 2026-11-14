import { TtlCache } from "./cache";
import { recordUpstreamCall } from "./meter";
import type { UpstreamAvailability, UpstreamClient, UpstreamPrice } from "./types";

/** Long enough that one basket never asks twice for a product and date; short enough that stock stays current. */
const CACHE_TTL_MS = 60_000;

type Fetch<T> = (ids: string[], date: string, customer: string) => Promise<Map<string, T>>;

/** Answers from the cache where possible and asks the wholesaler for the rest in one batched, counted request. */
async function cached<T>(cache: TtlCache<T>, ids: string[], date: string, customer: string, fetch: Fetch<T>): Promise<Map<string, T>> {
  const key = (id: string) => `${date}|${customer}|${id}`;
  const result = new Map<string, T>();
  const missing: string[] = [];
  for (const id of new Set(ids)) {
    const hit = cache.get(key(id));
    if (hit) result.set(id, hit);
    else missing.push(id);
  }
  if (missing.length === 0) return result;
  recordUpstreamCall(missing.length);
  const fetched = await fetch(missing, date, customer);
  for (const id of missing) {
    const value = fetched.get(id);
    if (value === undefined) continue;
    cache.set(key(id), value);
    result.set(id, value);
  }
  return result;
}

/** The wholesaler's price and availability APIs behind a short cache, with every request that reaches them counted. */
export class CachedUpstream implements UpstreamClient {
  private readonly prices = new TtlCache<UpstreamPrice>(CACHE_TTL_MS);
  private readonly stock = new TtlCache<UpstreamAvailability>(CACHE_TTL_MS);

  constructor(private readonly inner: UpstreamClient) {}

  price(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamPrice>> {
    return cached(this.prices, productIds, date, customer, (ids, d, c) => this.inner.price(ids, d, c));
  }

  availability(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamAvailability>> {
    return cached(this.stock, productIds, date, customer, (ids, d, c) => this.inner.availability(ids, d, c));
  }
}
