import { describe, expect, it } from "vitest";
import type { ProductFacts, SearchHit } from "@/lib/contracts";
import { createGateway } from "@/lib/gateway";
import { bestBuyFirst } from "@/lib/gateway/ranking";
import { AGENT, makeDeps } from "../support/deps";
import { fakeCatalog } from "../support/fakes";
import { PRODUCTS } from "../support/products";

interface Spec {
  id: string;
  price: number;
  orderable?: boolean;
  facts?: Partial<ProductFacts>;
}

function hit({ id, price, orderable = true, facts }: Spec): SearchHit {
  return {
    product: { ...PRODUCTS[0], id },
    score: 1,
    matched: [],
    facts: { labels: [], ...facts },
    offerPreview: {
      unitPrice: { amount: price, currency: "EUR" },
      comparisonPrice: { amount: price, per: "l" },
      availability: { status: orderable ? "available" : "partial" },
      orderable,
    },
  };
}

const HITS = [
  hit({ id: "dear-reliable", price: 1.4, facts: { deliveryReliability: 1, categoryAverageCo2PerKg: 1.1 } }),
  hit({ id: "cheap", price: 1.0, facts: { deliveryReliability: 0.9, categoryAverageCo2PerKg: 1.1 } }),
  hit({ id: "organic", price: 1.2, facts: { labels: ["organic", "finnish_origin"], deliveryReliability: 0.95, categoryAverageCo2PerKg: 1.1 } }),
  hit({ id: "short", price: 0.5, orderable: false, facts: { labels: ["organic", "msc"], deliveryReliability: 1 } }),
];

const ids = (hits: SearchHit[]) => hits.map((h) => h.product.id);

describe("best buy first", () => {
  it("ranks by price per litre or kilo by default", () => {
    expect(ids(bestBuyFirst(HITS))).toEqual(["cheap", "organic", "dear-reliable", "short"]);
  });

  it("ranks by delivery reliability, then price", () => {
    expect(ids(bestBuyFirst(HITS, "reliability"))).toEqual(["dear-reliable", "organic", "cheap", "short"]);
  });

  it("ranks certified sustainability labels first, then the lower category carbon, then price", () => {
    const lowCarbon = hit({ id: "low-carbon", price: 1.3, facts: { categoryAverageCo2PerKg: 0.4 } });
    expect(ids(bestBuyFirst([...HITS, lowCarbon], "sustainability"))).toEqual(["organic", "low-carbon", "cheap", "dear-reliable", "short"]);
  });

  it("never lifts a product that cannot be delivered in full on time", () => {
    for (const prefer of ["price", "reliability", "sustainability"] as const) expect(ids(bestBuyFirst(HITS, prefer)).at(-1)).toBe("short");
  });

  it("keeps the search order between equal hits", () => {
    const twins = [hit({ id: "first", price: 1 }), hit({ id: "second", price: 1 })];
    expect(ids(bestBuyFirst(twins, "reliability"))).toEqual(["first", "second"]);
  });
});

describe("search with a preference", () => {
  it("reorders a clear match only; an uncertain match keeps its relevance order", async () => {
    const catalog = fakeCatalog();
    const uncertain = { ...catalog, search: (request: Parameters<typeof catalog.search>[0]) => {
      const response = catalog.search(request);
      return { ...response, interpretation: { ...response.interpretation, confidence: "medium" as const } };
    } };
    const query = { query: "Eila", need: { amount: 100, unit: "l" as const }, deliverBy: "2026-11-16" };

    const clear = await createGateway(makeDeps().deps).searchCatalog(AGENT, { ...query, prefer: "reliability" });
    const orderable = clear.hits.filter((h) => h.offerPreview?.orderable).map((h) => h.facts.deliveryReliability ?? 0);
    expect(orderable).toEqual([...orderable].sort((a, b) => b - a));

    const relevance = ids(catalog.search({ ...query, limit: 10 }).hits);
    const unclear = await createGateway(makeDeps({ catalog: uncertain }).deps).searchCatalog(AGENT, { ...query, prefer: "reliability" });
    expect(ids(unclear.hits)).toEqual(relevance);
  });

  it("carries the four facts on every hit", async () => {
    const response = await createGateway(makeDeps().deps).searchCatalog(AGENT, { query: "Eila" });
    expect(response.hits.find((h) => h.product.id === "463335")?.facts).toEqual({ countryOfOrigin: "FI", labels: ["eu_organic"], deliveryReliability: 0.9 });
  });
});
