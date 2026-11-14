import { describe, expect, it } from "vitest";
import type { Offer, QuoteRequest } from "@/lib/contracts";
import { productFacts } from "@/lib/catalog/facts";
import { replacePayload } from "@/lib/demo/forge";
import { quote } from "@/lib/offers";
import { TIER_MEANING } from "@/lib/offers/alternatives";
import { TOKEN_TYPE } from "@/lib/trust/types";
import { QUOTE_CONTEXT, makeDeps } from "../support/deps";
import { fakeCatalog } from "../support/fakes";
import { DELIVER_BY, PRODUCTS } from "../support/products";

const HOUR_MS = 60 * 60 * 1000;

function request(productId: string, amount = 1000): QuoteRequest {
  return { lines: [{ productId, quantity: { amount, unit: "l" } }], deliverBy: DELIVER_BY };
}

describe("product facts", () => {
  it("names the carbon figure as a category average and leaves out what the wholesaler does not know", () => {
    const [eila] = PRODUCTS;
    expect(productFacts({ ...eila, labels: ["finnish_origin"], co2PerKg: 1.1 })).toEqual({
      countryOfOrigin: "FI",
      labels: ["finnish_origin"],
      deliveryReliability: 0.95,
      categoryAverageCo2PerKg: 1.1,
    });
    expect(productFacts({ ...eila, origin: undefined, deliveryReliability: undefined })).toEqual({ labels: [] });
    expect(productFacts(undefined)).toEqual({ labels: [] });
  });
});

describe("facts inside the signed offer", () => {
  it("puts origin, labels and delivery reliability on every line, under the wholesaler's signature", async () => {
    const { deps, trust } = makeDeps();
    const { primary, alternatives } = await quote(request("462775"), QUOTE_CONTEXT, deps);
    expect(primary.offer.lines[0].facts).toEqual({ countryOfOrigin: "FI", labels: [], deliveryReliability: 0.97 });
    const organic = alternatives.flatMap((alt) => alt.signed.offer.lines).find((line) => line.productId === "463335");
    expect(organic?.facts).toEqual({ countryOfOrigin: "FI", labels: ["eu_organic"], deliveryReliability: 0.9 });
    expect((await trust.verify<Offer>("supplier", primary.jws, TOKEN_TYPE.offer)).payload?.lines[0].facts).toEqual(primary.offer.lines[0].facts);
  });

  it("breaks the signature when the origin or a label is changed", async () => {
    const { deps, trust } = makeDeps();
    const { primary } = await quote(request("464306"), QUOTE_CONTEXT, deps);
    const edits: ((offer: Offer) => Offer)[] = [
      (offer) => ({ ...offer, lines: offer.lines.map((line) => ({ ...line, facts: { ...line.facts!, countryOfOrigin: "SE" } })) }),
      (offer) => ({ ...offer, lines: offer.lines.map((line) => ({ ...line, facts: { ...line.facts!, labels: ["eu_organic"] } })) }),
    ];
    for (const edit of edits) {
      expect(await trust.verify("supplier", replacePayload(primary.jws, edit), TOKEN_TYPE.offer)).toMatchObject({ valid: false });
    }
  });
});

describe("alternative tiers", () => {
  it("gives every alternative its tier and the one-sentence meaning of that tier", async () => {
    const { deps } = makeDeps();
    const { alternatives } = await quote(request("462775"), QUOTE_CONTEXT, deps);
    expect(alternatives.length).toBeGreaterThan(0);
    for (const alternative of alternatives) expect(alternative.meaning).toBe(TIER_MEANING[alternative.tier]);
  });

  it("names the tier even when fewer than three alternatives are offered", async () => {
    const withoutOrganic = PRODUCTS.filter((product) => product.labels.length === 0);
    const { deps } = makeDeps({ catalog: fakeCatalog(withoutOrganic) });
    const { alternatives } = await quote(request("462775"), QUOTE_CONTEXT, deps);
    expect(alternatives.map((alt) => [alt.tier, alt.meaning])).toEqual([
      ["good", TIER_MEANING.good],
      ["better", TIER_MEANING.better],
    ]);
  });
});

describe("offer validity", () => {
  it("holds the price for the time asked, never past the order cut-off", async () => {
    const hold = { ms: HOUR_MS };
    const { deps } = makeDeps({ offerValidityMs: () => hold.ms });
    expect((await quote(request("464306"), QUOTE_CONTEXT, deps)).primary.offer.expiresAt).toBe("2026-11-14T08:00:00.000Z");
    hold.ms = 24 * HOUR_MS;
    expect((await quote(request("464306"), QUOTE_CONTEXT, deps)).primary.offer.expiresAt).toBe("2026-11-14T12:00:00.000Z");
  });
});
