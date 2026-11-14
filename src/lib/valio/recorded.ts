import { readFileSync } from "node:fs";
import path from "node:path";
import { normaliseAvailability, normalisePrice } from "./normalise";
import { unknownAvailability, unknownPrice, type RawProductAvailability, type RawProductPrice } from "./raw";
import type { UpstreamAvailability, UpstreamClient, UpstreamPrice } from "./types";

/** File layout of fixtures/upstream/{price,availability}.json: raw API answers keyed by product id. */
export interface FixtureFile<T> {
  meta: { recordedAt: string; requestedDate: string; customer: string };
  products: Record<string, T>;
}

export function fixturesDir(): string {
  return process.env.LAITURI_FIXTURES_DIR ?? path.join(process.cwd(), "fixtures", "upstream");
}

function readFixture<T>(name: string): FixtureFile<T> {
  const file = path.join(fixturesDir(), name);
  try {
    return JSON.parse(readFileSync(file, "utf8")) as FixtureFile<T>;
  } catch {
    throw new Error(`Recorded upstream data is missing at ${file}. Run: npx tsx scripts/record-fixtures.ts`);
  }
}

/** Replays recorded wholesaler answers. Date and customer are ignored, as the recording holds one of each. */
export class RecordedUpstream implements UpstreamClient {
  private prices?: Record<string, RawProductPrice>;
  private stock?: Record<string, RawProductAvailability>;

  async price(productIds: string[]): Promise<Map<string, UpstreamPrice>> {
    this.prices ??= readFixture<RawProductPrice>("price.json").products;
    const table = this.prices;
    return new Map(productIds.map((id) => [id, normalisePrice(table[id] ?? unknownPrice(id))]));
  }

  async availability(productIds: string[]): Promise<Map<string, UpstreamAvailability>> {
    this.stock ??= readFixture<RawProductAvailability>("availability.json").products;
    const table = this.stock;
    return new Map(productIds.map((id) => [id, normaliseAvailability(table[id] ?? unknownAvailability(id))]));
  }
}
