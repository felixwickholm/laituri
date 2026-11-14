import { describe, expect, it } from "vitest";
import { CreateBasketRequest } from "@/lib/contracts";
import { addLine, cartDeliveryDay, cartEstimate, lineAmountText, parseCart, setPacks, toBasketRequest, type CartLine } from "@/lib/shop-console/cart";

const milk: CartLine = {
  productId: "464306",
  name: "Arki Eila semi-skimmed lactose-free milk 1 l",
  pack: "1 l",
  salesUnit: "ST",
  packs: 1,
  step: 1,
  unitPrice: 1.2,
  content: { amount: 1, unit: "l" },
  deliveryDate: "2026-11-16",
};
const eggs: CartLine = { productId: "e1", name: "Barn eggs", pack: "6 pieces", salesUnit: "KI", packs: 2, step: 2, unitPrice: 9.5, deliveryDate: "2026-11-17" };

describe("cart", () => {
  it("adds packs to a line already there", () => {
    const cart = addLine(addLine([], milk), { ...milk, packs: 3 });
    expect(cart).toHaveLength(1);
    expect(cart[0].packs).toBe(4);
  });

  it("rounds to the order step and takes a line out at zero", () => {
    expect(setPacks([eggs], "e1", 3)[0].packs).toBe(4);
    expect(setPacks([eggs, milk], "e1", 0)).toEqual([milk]);
  });

  it("estimates the net total and asks for the latest delivery day", () => {
    const cart = [{ ...milk, packs: 10 }, eggs];
    expect(cartEstimate(cart)).toBe(31);
    expect(cartDeliveryDay(cart)).toBe("2026-11-17");
    expect(cartDeliveryDay([])).toBeUndefined();
  });

  it("orders as a manual basket the API accepts, in litres, kilos or pieces", () => {
    const request = toBasketRequest([{ ...milk, packs: 20 }, eggs], "2026-11-17");
    expect(CreateBasketRequest.parse(request)).toEqual(request);
    expect(request.source).toBe("manual");
    expect(request.lines).toEqual([
      { words: "Arki Eila semi-skimmed lactose-free milk", productId: "464306", quantity: { amount: 20, unit: "l" } },
      { words: "Barn eggs", productId: "e1", quantity: { amount: 2, unit: "pcs" } },
    ]);
    expect(lineAmountText({ ...milk, packs: 20 })).toBe("20 l");
  });

  it("sends the product's words without its pack size, so the size is not read as the amount", () => {
    const named = (name: string) => toBasketRequest([{ ...milk, name }], "2026-11-17").lines[0].words;
    expect(named("Valio butter unsalted 500 g")).toBe("Valio butter unsalted");
    expect(named("Eila butter lactose-free 4x5 kg")).toBe("Eila butter lactose-free");
    expect(named("Kieku Barn Eggs L180 12300 g")).toBe("Kieku Barn Eggs L180");
    expect(named("Viola light natural cream lactose-free… 3,5 kg")).toBe("Viola light natural cream lactose-free");
    expect(named("Barn eggs")).toBe("Barn eggs");
  });

  it("drops a stored cart it cannot trust", () => {
    expect(parseCart(JSON.stringify([milk, { productId: 4 }, null]))).toEqual([milk]);
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart(null)).toEqual([]);
  });
});
