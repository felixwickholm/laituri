import { describe, expect, it } from "vitest";
import type { QuoteRequest } from "@/lib/contracts";
import { UpstreamError } from "@/lib/gateway/errors";
import { quote } from "@/lib/offers";
import { QUOTE_CONTEXT, makeDeps } from "../support/deps";
import { DELIVER_BY } from "../support/products";

const ctx = QUOTE_CONTEXT;

function request(productId: string, amount = 1000, unit: "l" | "kg" | "sales_unit" = "l"): QuoteRequest {
  return { lines: [{ productId, quantity: { amount, unit } }], deliverBy: DELIVER_BY };
}

describe("quote", () => {
  it("prices a full offer with totals in cents, signs and stores it", async () => {
    const { deps, trust, store, upstream } = makeDeps();
    const { primary, alternatives } = await quote(request("464306"), ctx, deps);
    const { offer } = primary;

    expect(offer.fulfilment).toBe("full");
    expect(offer.id).toMatch(/^off_[a-z2-7]{10}$/);
    expect(offer.lines[0]).toMatchObject({ quantity: 1000, content: { amount: 1000, unit: "l" }, taxRate: 13.5 });
    expect(offer.lines[0].availability).toMatchObject({ status: "available", requested: 1000, available: 1000 });
    expect(offer.totals).toEqual({
      net: { amount: 1010, currency: "EUR" },
      tax: { amount: 136.35, currency: "EUR" },
      gross: { amount: 1146.35, currency: "EUR" },
    });
    expect(offer.deliveryDate).toBe("2026-11-16");
    expect(offer.issuer).toBe("Valio Aimo");
    expect(offer.source.system).toBe("Valio Aimo mock API");
    expect(offer.expiresAt).toBe("2026-11-14T07:15:00.000Z");
    expect(alternatives).toEqual([]);
    expect((await trust.verify("supplier", primary.jws)).payload).toEqual(offer);
    expect(await store.offers.get(offer.id)).toEqual(primary);
    expect(upstream.calls.map((c) => c.kind).sort()).toEqual(["availability", "price"]);
    expect(upstream.calls[0].date).toBe(DELIVER_BY);
  });

  it("offers the 51 units in stock as partial, with substitutes covering the full need", async () => {
    const { deps } = makeDeps();
    const { primary, alternatives } = await quote(request("462775"), ctx, deps);

    expect(primary.offer.fulfilment).toBe("partial");
    expect(primary.offer.lines[0]).toMatchObject({ quantity: 51, availability: { status: "partial", requested: 1000, available: 51 } });
    expect(primary.offer.notes).toContain("Only 51 of 1,000 units of Valio Eila Fat Free UHT 1 l are in stock.");

    const good = alternatives.find((a) => a.tier === "good")!;
    expect(good.signed.offer.lines).toHaveLength(1);
    expect(good.signed.offer.lines[0]).toMatchObject({ productId: "464306", quantity: 1000 });
    expect(good.signed.offer.lines[0].substituteFor).toMatchObject({ productId: "462775", likeForLike: true, priceChangePct: 2 });
    expect(good.signed.offer.fulfilment).toBe("substituted");
    expect(good.tradeoff).toBe("Same product type from Valio, 2 % more expensive, in full on Monday.");

    const better = alternatives.find((a) => a.tier === "better")!;
    const lines = better.signed.offer.lines;
    expect(lines.map((l) => l.productId)).toEqual(["462775", "464306"]);
    expect(lines.reduce((sum, l) => sum + (l.content?.amount ?? 0), 0)).toBe(1000);
    expect(lines[0].availability.status).toBe("available");

    const best = alternatives.find((a) => a.tier === "best")!;
    expect(best.signed.offer.lines[0].productId).toBe("463335");
    expect(alternatives.map((a) => a.tier)).toEqual(["good", "better", "best"]);
    expect(alternatives.flatMap((a) => a.signed.offer.lines).map((l) => l.productId)).not.toContain("464073");
  });

  it("reports a passed cut-off and offers an on-time alternative", async () => {
    const { deps } = makeDeps();
    const { primary, alternatives } = await quote(request("465039"), ctx, deps);

    expect(primary.offer.lines[0].availability).toMatchObject({ status: "cutoff_passed", requested: 200 });
    expect(primary.offer.fulfilment).toBe("unavailable");
    expect(primary.offer.notes).toContain("The order cut-off for Monday 16 Nov passed on Thu 12 Nov 12:00.");
    const good = alternatives.find((a) => a.tier === "good")!;
    expect(good.signed.offer.fulfilment).toBe("substituted");
    expect(good.signed.offer.deliveryDate).toBe("2026-11-16");
    expect(good.signed.offer.lines[0]).toMatchObject({ productId: "464306", quantity: 1000 });
  });

  it("answers an unknown product as unavailable without crashing", async () => {
    const { deps } = makeDeps();
    const { primary, alternatives } = await quote(request("999999", 5, "sales_unit"), ctx, deps);
    expect(primary.offer.fulfilment).toBe("unavailable");
    expect(primary.offer.lines[0]).toMatchObject({ quantity: 0, availability: { status: "unavailable", requested: 5 } });
    expect(primary.offer.notes).toEqual(["Product 999999 is not in the catalogue."]);
    expect(primary.offer.totals.net.amount).toBe(0);
    expect(alternatives).toEqual([]);
  });

  it("caps the offer expiry at the order cut-off", async () => {
    const { deps, upstream } = makeDeps();
    upstream.stock.get("464306")!.orderBy = "2026-11-14T09:10:00+02:00";
    const { primary } = await quote(request("464306"), ctx, deps);
    expect(primary.offer.expiresAt).toBe("2026-11-14T07:10:00.000Z");
    expect(primary.offer.orderBy).toBe("2026-11-14T09:10:00+02:00");
  });

  it("rounds kilograms up to the lot size", async () => {
    const { deps } = makeDeps();
    const { primary } = await quote(request("470001", 3, "kg"), ctx, deps);
    expect(primary.offer.lines[0]).toMatchObject({ quantity: 8, content: { amount: 4, unit: "kg" } });
  });

  it("reports a late delivery", async () => {
    const { deps, upstream } = makeDeps();
    upstream.stock.get("464306")!.availableDate = "2026-11-17";
    const { primary } = await quote(request("464306"), ctx, deps);
    expect(primary.offer.fulfilment).toBe("late");
    expect(primary.offer.notes[0]).toBe("Valio Eila 1 l arrives on Tuesday 17 Nov, after the requested Monday 16 Nov.");
  });

  it("turns an upstream failure into a typed error", async () => {
    const { deps, upstream } = makeDeps();
    upstream.fail = true;
    await expect(quote(request("464306"), ctx, deps)).rejects.toBeInstanceOf(UpstreamError);
  });
});
