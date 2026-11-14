import { fetchRawAvailability, fetchRawPrices, type UpstreamConfig } from "./http";
import { normaliseAvailability, normalisePrice } from "./normalise";
import { unknownAvailability, unknownPrice } from "./raw";
import type { UpstreamAvailability, UpstreamClient, UpstreamPrice } from "./types";

/** Asks the API for every id in one batched call; ids it does not answer for get an "unknown" answer. */
function batched<T extends { productId: string }>(ids: string[], fetched: T[], fallback: (id: string) => T): Map<string, T> {
  const byId = new Map(fetched.map((item) => [item.productId, item]));
  return new Map(ids.map((id) => [id, byId.get(id) ?? fallback(id)]));
}

/** The wholesaler's live API. Cached and counted by CachedUpstream, which wraps it. */
export class LiveUpstream implements UpstreamClient {
  constructor(private readonly config: UpstreamConfig) {}

  async price(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamPrice>> {
    const fetched = (await fetchRawPrices(this.config, productIds, date, customer)).map(normalisePrice);
    return batched(productIds, fetched, (id) => normalisePrice(unknownPrice(id)));
  }

  async availability(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamAvailability>> {
    const fetched = (await fetchRawAvailability(this.config, productIds, date, customer)).map(normaliseAvailability);
    return batched(productIds, fetched, (id) => normaliseAvailability(unknownAvailability(id)));
  }
}
