import { describe, expect, it } from "vitest";
import { shortProductName, tidyProductText } from "@/lib/console/format/product";

describe("shortProductName", () => {
  it.each([
    ["Valio Hyvä suomalainen Arki® Eila® semi skimmed milk drink 1 l lactose free", "Arki Eila semi-skimmed lactose-free milk 1 l"],
    ["Valio Eila® 3 % milk drink 1 l lactose free", "Eila 3 % lactose-free milk 1 l"],
    ["Valio Eila®  Luomu™ semi skimmed milk drink 1 l lactose free, organic", "Eila semi-skimmed lactose-free organic milk 1 l"],
    ["Arla Milkdrink 1L lactose free fat free UHT Suomesta", "Arla Milkdrink fat-free lactose-free UHT 1 l"],
    ["Valio skimmed milk 1 l", "Valio skimmed milk 1 l"],
    ["Valio Eila® butter 200 g lactose free", "Eila lactose-free butter 200 g"],
    ["Oatly Oat Drink Organic 1L", "Oatly Oat organic Drink 1 l"],
    ["Valio Viola® light 3,5 kg natural cream cheese lactose free", "Viola light natural cream lactose-free… 3,5 kg"],
  ])("%s", (name, short) => {
    const result = shortProductName(name);
    expect(result).toBe(short);
    expect(result.length).toBeLessThanOrEqual(48);
  });

  it("tidies product names inside sentences", () => {
    expect(tidyProductText("Ordered 1,000 x Valio Hyvä suomalainen Arki® Eila® milk 1 l.")).toBe("Ordered 1,000 x Valio Arki Eila milk 1 l.");
  });
});
