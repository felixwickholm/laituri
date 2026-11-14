import { describe, expect, it } from "vitest";
import { createGateway } from "@/lib/gateway";
import { AGENT, makeDeps } from "../support/deps";

describe("searchCatalog previews", () => {
  it("adds live price, stock and pack maths with one call of each kind", async () => {
    const { deps, upstream } = makeDeps();
    const response = await createGateway(deps).searchCatalog(AGENT, {
      query: "Eila",
      need: { amount: 100, unit: "l" },
      deliverBy: "2026-11-16",
    });
    expect(upstream.calls.map((call) => call.kind).sort()).toEqual(["availability", "price"]);
    const byId = new Map(response.hits.map((hit) => [hit.product.id, hit.offerPreview]));
    expect(byId.get("464306")).toMatchObject({
      unitsNeeded: 100,
      unitPrice: { amount: 1.01, currency: "EUR" },
      estimatedNet: { amount: 101, currency: "EUR" },
      availability: { status: "available", deliveryDate: "2026-11-16" },
      orderable: true,
    });
    expect(byId.get("462775")).toMatchObject({ availability: { status: "partial", available: 51 }, orderable: false });
    expect(byId.get("465039")).toMatchObject({ unitsNeeded: 20, availability: { status: "cutoff_passed" }, orderable: false });
  });

  it("returns the hits without previews when the wholesaler does not answer", async () => {
    const { deps, upstream } = makeDeps();
    upstream.fail = true;
    const response = await createGateway(deps).searchCatalog(AGENT, { query: "Eila" });
    expect(response.hits.length).toBeGreaterThan(0);
    expect(response.hits.every((hit) => hit.offerPreview === undefined)).toBe(true);
  });
});
