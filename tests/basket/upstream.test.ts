import "../store/temp-data-dir";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_DEMO_STEP_MS = "0";
process.env.LAITURI_CATALOG = path.resolve("fixtures/upstream/catalog.json");

const { buyerAgent, startBasket, toBasket, weeklyRequest } = await import("@/lib/basket");
const { gateway } = await import("@/lib/gateway");
const { BUYER_IDS } = await import("@/lib/mandate");
const { RecordedUpstream, UPSTREAM_ID_CAP, upstreamUsage } = await import("@/lib/valio");
const { CachedUpstream } = await import("@/lib/valio/cached");

const recorded = existsSync(path.resolve("fixtures/upstream/price.json"));

/** Every request that reaches the recorded wholesaler, by the number of product ids it carried. */
let asked: number[] = [];

beforeEach(async () => {
  await gateway().reset();
  asked = [];
  for (const method of ["price", "availability"] as const) {
    const original = RecordedUpstream.prototype[method] as (this: unknown, ids: string[]) => Promise<never>;
    vi.spyOn(RecordedUpstream.prototype, method).mockImplementation(function (this: unknown, ids: string[]) {
      asked.push(ids.length);
      return original.call(this, ids);
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.skipIf(!recorded)("asking the wholesaler only when needed", () => {
  it("previews at most the capped number of search hits", async () => {
    await gateway().searchCatalog({ id: "agent:test", name: "Test" }, { query: "maito", limit: 50, deliverBy: "2026-11-17" });
    expect(Math.max(...asked)).toBeLessThanOrEqual(UPSTREAM_ID_CAP.search);
  });

  it("asks about a quoted line and its closest substitutes only", async () => {
    await gateway().requestQuote({ id: "agent:test", name: "Test" }, {
      lines: [{ productId: "462775", quantity: { amount: 200, unit: "l" } }],
      deliverBy: "2026-11-18",
    });
    expect(Math.max(...asked)).toBeLessThanOrEqual(UPSTREAM_ID_CAP.quoteLine);
  });

  it("asks about a 20-line weekly order in a few batched requests, then answers a repeat from the cache", async () => {
    const before = upstreamUsage().workspace;
    const request = { ...weeklyRequest(BUYER_IDS.nordicHarbour, "2026-11-16"), title: "Upstream test" };
    const first = toBasket((await (await startBasket(request, await buyerAgent(BUYER_IDS.nordicHarbour))).done)!);
    const perLine = UPSTREAM_ID_CAP.search + UPSTREAM_ID_CAP.quoteLine;
    expect(first.totals.lines).toBe(20);
    // One batch for the whole basket's candidates, then a few for lines that look further, such as a safe swap.
    expect(first.totals.upstreamCalls).toBeLessThanOrEqual(12);
    expect(first.totals.productsAsked).toBeLessThanOrEqual(20 * perLine);
    expect(Math.max(...asked)).toBeLessThanOrEqual(20 * perLine);
    expect(asked.filter((size) => size > UPSTREAM_ID_CAP.quoteLine)).toHaveLength(2);
    const after = upstreamUsage().workspace;
    expect(after.productsAsked - before.productsAsked).toBe(first.totals.productsAsked);

    // The standing order runs once per delivery day: starting it again answers with the same basket.
    expect((await startBasket(request, await buyerAgent(BUYER_IDS.nordicHarbour))).basket.id).toBe(first.id);
    asked = [];
    const again = toBasket((await (await startBasket({ ...request, source: "manual" }, await buyerAgent(BUYER_IDS.nordicHarbour))).done)!);
    expect(again.totals.upstreamCalls).toBe(0);
    expect(asked).toEqual([]);
  });

  it("asks the wrapped client only for ids it has not answered recently", async () => {
    const client = new CachedUpstream(new RecordedUpstream());
    await client.price(["464306", "462775"], "2026-11-16", "123");
    await client.price(["464306", "462775", "464401"], "2026-11-16", "123");
    await client.price(["464306"], "2026-11-17", "123");
    expect(asked).toEqual([2, 1, 1]);
  });
});
