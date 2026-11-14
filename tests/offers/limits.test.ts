import { afterEach, describe, expect, it } from "vitest";
import type { QuoteRequest } from "@/lib/contracts";
import { TOKEN_TYPE } from "@/lib/trust/types";
import { quote } from "@/lib/offers";
import { QUOTE_CONTEXT, makeDeps } from "../support/deps";
import { DELIVER_BY } from "../support/products";

function request(productId: string, amount: number, unit: "l" | "kg" | "sales_unit" = "l", deliverBy = DELIVER_BY): QuoteRequest {
  return { lines: [{ productId, quantity: { amount, unit } }], deliverBy };
}

afterEach(() => {
  delete process.env.LAITURI_MAX_LINE_LITRES;
});

describe("stock the wholesaler does not track", () => {
  it("says so in the signed line instead of claiming the requested amount is in stock", async () => {
    const { deps, trust } = makeDeps();
    const { primary } = await quote(request("464306", 1000), QUOTE_CONTEXT, deps);
    const availability = primary.offer.lines[0].availability;

    expect(availability).toMatchObject({ status: "available", requested: 1000, stock: "untracked" });
    expect(availability.available).toBeUndefined();
    expect((await trust.verify<typeof primary.offer>("supplier", primary.jws, TOKEN_TYPE.offer)).payload?.lines[0].availability.stock).toBe("untracked");
  });

  it("gives the counted amount for tracked stock", async () => {
    const { deps } = makeDeps();
    const { primary } = await quote(request("463335", 100), QUOTE_CONTEXT, deps);
    expect(primary.offer.lines[0].availability).toMatchObject({ stock: "tracked", available: 5000 });
  });
});

describe("the per-line ceiling", () => {
  it("refuses a trillion litres with a plain 422 problem before asking the wholesaler", async () => {
    const { deps, upstream } = makeDeps();
    await expect(quote(request("464306", 1e12), QUOTE_CONTEXT, deps)).rejects.toMatchObject({
      status: 422,
      code: "quantity_implausible",
      message: expect.stringContaining("at most 20,000 l"),
    });
    expect(upstream.calls).toEqual([]);
  });

  it("keeps 1,000 litres of milk and the ceiling itself normal, and refuses one litre more", async () => {
    const { deps } = makeDeps();
    expect((await quote(request("464306", 1000), QUOTE_CONTEXT, deps)).primary.offer.fulfilment).toBe("full");
    expect((await quote(request("464306", 20_000), QUOTE_CONTEXT, deps)).primary.offer.fulfilment).toBe("full");
    await expect(quote(request("464306", 20_001), QUOTE_CONTEXT, deps)).rejects.toMatchObject({ code: "quantity_implausible" });
  });

  it("holds kilograms and sales units to their own ceilings", async () => {
    const { deps } = makeDeps();
    await expect(quote(request("470001", 20_001, "kg"), QUOTE_CONTEXT, deps)).rejects.toMatchObject({ code: "quantity_implausible" });
    await expect(quote(request("464306", 20_001, "sales_unit"), QUOTE_CONTEXT, deps)).rejects.toMatchObject({ code: "quantity_implausible" });
  });

  it("can be set per deployment", async () => {
    process.env.LAITURI_MAX_LINE_LITRES = "500";
    const { deps } = makeDeps();
    await expect(quote(request("464306", 1000), QUOTE_CONTEXT, deps)).rejects.toMatchObject({ message: expect.stringContaining("at most 500 l") });
  });
});

describe("the delivery date", () => {
  it("refuses a date before today with a plain 422 problem", async () => {
    const { deps, upstream } = makeDeps();
    await expect(quote(request("464306", 100, "l", "2026-11-13"), QUOTE_CONTEXT, deps)).rejects.toMatchObject({
      status: 422,
      code: "delivery_date_past",
      message: "The delivery date 2026-11-13 is in the past: today is 2026-11-14. Ask for today or a later date.",
    });
    expect(upstream.calls).toEqual([]);
  });

  it("accepts today", async () => {
    const { deps } = makeDeps();
    await expect(quote(request("464306", 100, "l", "2026-11-14"), QUOTE_CONTEXT, deps)).resolves.toBeDefined();
  });
});
