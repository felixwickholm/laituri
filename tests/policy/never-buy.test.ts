import { describe, expect, it } from "vitest";
import { Mandate } from "@/lib/contracts";
import { evaluate, neverBuyHit, neverBuyOf } from "@/lib/policy";
import { offerAllowedByNeverBuy } from "@/lib/policy/never-buy";
import { MandatePatchBody } from "@/lib/openapi/schemas";
import { input, line, mandate, offer, product } from "./fixtures";

const base = mandate();
const withList = (products: { productId: string; name: string }[], words: string[] = []) =>
  mandate({ dietary: { ...base.dietary, neverBuy: { products, words } } });

function neverBuyCheck(data: ReturnType<typeof input>) {
  return evaluate(data).checks.find((check) => check.rule === "product.never_buy");
}

describe("product.never_buy", () => {
  it("passes when the list is absent, so a mandate signed before the list existed still works", () => {
    expect(base.dietary.neverBuy).toBeUndefined();
    expect(Mandate.safeParse(base).success).toBe(true);
    expect(neverBuyOf(base)).toEqual({ products: [], words: [] });
    expect(neverBuyCheck(input())).toMatchObject({ status: "pass", message: "Your never-buy list is empty." });
    expect(evaluate(input()).outcome).toBe("auto_approved");
  });

  it("blocks a listed product, and nobody can approve it through the agent channel", () => {
    const data = input({ mandate: withList([{ productId: "464306", name: "Valio Arki milk drink" }]) });
    expect(neverBuyCheck(data)).toMatchObject({ status: "block", observed: "464306" });
    expect(neverBuyCheck(data)?.message).toContain("is on your never-buy list.");
    expect(evaluate(data).outcome).toBe("blocked");
  });

  it("blocks a product whose name in any language has a listed word, as a whole word", () => {
    const palm = product({ id: "900", name: { en: "Margarine with palm oil 400 g", fi: "Margariini palmuöljy" } });
    const data = input({ mandate: withList([], ["palm oil"]), products: [palm], offer: offer({}, [line({ productId: "900", name: "Margarine with palm oil 400 g" })]) });
    expect(neverBuyCheck(data)).toMatchObject({ status: "block" });
    expect(neverBuyCheck(data)?.message).toContain('Its name has "palm oil".');
    expect(neverBuyHit(withList([], ["palmuöljy"]), palm)).toEqual({ by: "word", entry: "palmuöljy" });
    // "oil" is not a whole word of "Soil" or "boiled".
    expect(neverBuyHit(withList([], ["oil"]), product({ name: { en: "Boiled potatoes", fi: "Keitetty peruna" } }))).toBeUndefined();
  });

  it("blocks a swap onto a listed product and ignores a line the offer delivers none of", () => {
    const listed = withList([{ productId: "777", name: "Alpro almond drink" }]);
    const swap = offer({}, [line({ quantity: 0 }), line({ productId: "777", name: "Alpro almond drink 1 l", substituteFor: { productId: "464306", name: "Milk drink", reason: "Only 0 of 100 in stock.", likeForLike: true, priceChangePct: 2 } })]);
    expect(neverBuyCheck(input({ mandate: listed, offer: swap }))?.status).toBe("block");
    const originalListed = withList([{ productId: "464306", name: "Milk drink" }]);
    const swapAway = offer({}, [line({ quantity: 0 }), line({ productId: "777", name: "Other milk 1 l" })]);
    expect(neverBuyCheck(input({ mandate: originalListed, offer: swapAway }))?.status).toBe("pass");
    expect(offerAllowedByNeverBuy(listed, swap)).toBe(false);
    expect(offerAllowedByNeverBuy(originalListed, swapAway)).toBe(true);
  });

  it("is part of the mandate patch the approver may send, and words default to none", () => {
    const parsed = MandatePatchBody.parse({ dietary: { neverBuy: { products: [{ productId: "777", name: "Alpro almond drink" }] } } });
    expect(parsed).toEqual({ dietary: { neverBuy: { products: [{ productId: "777", name: "Alpro almond drink" }], words: [] } } });
  });

  it("rules out an offered swap by its Finnish or Swedish name too, as the rule does", () => {
    const butter = product({ id: "464411", name: { en: "Valio butter 500 g unsalted", fi: "Valio voi 500 g suolaamaton", sv: "Valio smör 500 g osaltat" } });
    const lookup = (id: string) => (id === butter.id ? butter : undefined);
    const offered = { lines: [{ productId: "464411", name: "Valio butter 500 g unsalted", quantity: 10 }] };
    expect(offerAllowedByNeverBuy(withList([], ["voi"]), offered, lookup)).toBe(false);
    expect(offerAllowedByNeverBuy(withList([], ["smör"]), offered, lookup)).toBe(false);
    expect(neverBuyHit(withList([], ["voi"]), butter)).toEqual({ by: "word", entry: "voi" });
    expect(offerAllowedByNeverBuy(withList([], ["palmuöljy"]), offered, lookup)).toBe(true);
    expect(offerAllowedByNeverBuy(withList([], ["voi"]), { lines: [{ ...offered.lines[0], quantity: 0 }] }, lookup)).toBe(true);
  });
});
