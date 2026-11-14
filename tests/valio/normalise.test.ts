import { describe, expect, it } from "vitest";
import { normaliseAvailability, normalisePrice } from "@/lib/valio/normalise";
import { unknownAvailability, unknownPrice, type RawProductAvailability } from "@/lib/valio/raw";

function availability(amount: number | null, extra: Partial<RawProductAvailability> = {}): RawProductAvailability {
  return {
    productId: "464306",
    closingTime: "2026-11-15T17:00:00+0200",
    salesBlock: false,
    logisticModel: "Stock",
    scheduleLines: amount === null ? [] : [{ salesBlock: false, availableAmount: amount, availableDate: "2026-11-16", salesUnit: "ST" }],
    ...extra,
  };
}

describe("normaliseAvailability", () => {
  it("treats 9999999999 and 999999 as no tracked limit", () => {
    expect(normaliseAvailability(availability(9999999999)).available).toBe(Infinity);
    expect(normaliseAvailability(availability(999999, { logisticModel: "Terminal" })).available).toBe(Infinity);
  });

  it("keeps a real limit and the order cut-off", () => {
    const result = normaliseAvailability(availability(51));
    expect(result).toMatchObject({
      deliverable: true,
      available: 51,
      availableDate: "2026-11-16",
      orderBy: "2026-11-15T17:00:00+02:00",
      logisticModel: "Stock",
      salesUnit: "ST",
    });
    expect(Number.isNaN(Date.parse(result.orderBy!))).toBe(false);
  });

  it("reports zero stock as not deliverable", () => {
    const raw = availability(0);
    raw.scheduleLines[0].availableDate = null;
    expect(normaliseAvailability(raw)).toMatchObject({ deliverable: false, available: 0, availableDate: undefined, orderBy: undefined });
  });

  it("reports empty schedule lines as not deliverable", () => {
    expect(normaliseAvailability(availability(null))).toMatchObject({ deliverable: false, available: 0 });
    expect(normaliseAvailability(unknownAvailability("999999999")).deliverable).toBe(false);
  });

  it("picks the first schedule line with stock", () => {
    const raw = availability(0);
    raw.scheduleLines.push({ salesBlock: false, availableAmount: 12, availableDate: "2026-11-18", salesUnit: "ST" });
    expect(normaliseAvailability(raw)).toMatchObject({ available: 12, availableDate: "2026-11-18" });
  });
});

describe("normalisePrice", () => {
  it("maps net, gross, tax and the comparison price", () => {
    const price = normalisePrice({
      productId: "464306",
      quantity: 1,
      catalogPrice: { value: 1.01, valueWithTax: 1.15, validTo: "2026-12-31T00:00:00+0200" },
      comparisonPrice: { value: 1.01 },
      comparisonUnit: "L",
      tax: { taxRate: 13.5, taxValue: 0.14 },
      listPrice: { value: 1.44 },
      netPriceFound: true,
      error: false,
    });
    expect(price).toEqual({
      productId: "464306",
      found: true,
      net: 1.01,
      gross: 1.15,
      taxRate: 13.5,
      comparison: { amount: 1.01, per: "l" },
      listNet: 1.44,
      contractPrice: true,
      validTo: "2026-12-31T00:00:00+02:00",
    });
  });

  it("reports an unknown id as not found", () => {
    expect(normalisePrice(unknownPrice("999999999"))).toEqual({ productId: "999999999", found: false, contractPrice: false });
  });
});
