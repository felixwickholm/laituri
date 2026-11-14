import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordedUpstream, upstream, upstreamMode, type UpstreamClient } from "@/lib/valio";
import { LiveUpstream } from "@/lib/valio/live";

describe("recorded upstream", () => {
  const client: UpstreamClient = new RecordedUpstream();

  it("replays price and availability for a recorded product", async () => {
    const [prices, stock] = await Promise.all([
      client.price(["464306"], "2026-11-16", "123"),
      client.availability(["464306"], "2026-11-16", "123"),
    ]);
    expect(prices.get("464306")).toMatchObject({ found: true, taxRate: 13.5, comparison: { per: "l" } });
    expect(prices.get("464306")!.net).toBeGreaterThan(0);
    expect(stock.get("464306")).toMatchObject({ deliverable: true, logisticModel: "Stock", available: Infinity });
  });

  it("keeps the real limit and the passed cut-off from the recording", async () => {
    const stock = await client.availability(["462775", "465039"], "2026-11-16", "123");
    expect(stock.get("462775")?.available).toBe(51);
    expect(Date.parse(stock.get("465039")!.orderBy!)).toBeLessThan(Date.parse("2026-11-14T09:00:00+02:00"));
  });

  it("answers an unknown id like the live API", async () => {
    const [prices, stock] = await Promise.all([
      client.price(["unknown-1"], "2026-11-16", "123"),
      client.availability(["unknown-1"], "2026-11-16", "123"),
    ]);
    expect(prices.get("unknown-1")).toEqual({ productId: "unknown-1", found: false, contractPrice: false });
    expect(stock.get("unknown-1")).toMatchObject({ deliverable: false, available: 0 });
  });
});

describe("upstream selection", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("uses recorded data when asked or when no API key is set", () => {
    process.env.VALIO_MODE = "recorded";
    expect(upstreamMode()).toBe("recorded");
    expect(upstream()).toBeInstanceOf(RecordedUpstream);
    delete process.env.VALIO_MODE;
    delete process.env.VALIO_API_KEY;
    expect(upstreamMode()).toBe("recorded");
  });
});

describe("live upstream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("batches ids into one call and serves repeats from the cache", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { products: string[] };
      const products = body.products.map((productId) => ({ productId, salesBlock: false, scheduleLines: [] }));
      return new Response(JSON.stringify({ products }), { status: 200 });
    });
    const client = new LiveUpstream({ baseUrl: "https://example.test/api", apiKey: "test" });
    await client.availability(["1", "2", "2"], "2026-11-16", "123");
    await client.availability(["1", "2"], "2026-11-16", "123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).products).toEqual(["1", "2"]);
  });

  it("retries once on 429 and then fails with an UpstreamError", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response("busy", { status: 429, headers: { "retry-after": "0.01" } }),
    );
    const client = new LiveUpstream({ baseUrl: "https://example.test/api", apiKey: "test" });
    await expect(client.price(["1"], "2026-11-16", "123")).rejects.toMatchObject({ name: "UpstreamError", status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
