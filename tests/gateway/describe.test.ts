import { describe, expect, it } from "vitest";
import { quoteDetail } from "@/lib/gateway/describe";
import { offer } from "../policy/fixtures";

const signed = (patch: Parameters<typeof offer>[0]) => ({ primary: { offer: offer(patch), jws: "x.y.z" }, alternatives: [] });

describe("the wholesaler's line for a quote", () => {
  it("calls a quote that meets the words a full offer", () => {
    expect(quoteDetail(signed({}))).toBe("Full offer, 101.00 EUR net");
  });

  it("gives a quote that failed the request check its own outcome, never 'Full offer'", () => {
    const failed = signed({
      requestCheck: [
        { requirement: "product", asked: "oat drink", offered: "Valio milk", result: "unmet", certain: true },
        { requirement: "budget", asked: "at most €50.00", offered: "€114.63 with VAT", result: "unmet", certain: false },
      ],
    });
    expect(quoteDetail(failed)).toBe("Offer not as asked (product, budget), 101.00 EUR net");
  });
});
