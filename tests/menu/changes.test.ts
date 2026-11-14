import { describe, expect, it } from "vitest";
import { menuChanges } from "@/lib/menu/changes";
import { kitchenRound, scaled, total, WASTE_FACTOR } from "@/lib/menu/scale";

const kg = (amount: number) => ({ amount, unit: "kg" as const });

describe("event changes", () => {
  it("lists each line that gets smaller when fewer guests come", () => {
    const before = new Map([["salmon fillet", kg(13.5)], ["potatoes", kg(17)], ["sugar", kg(0.5)]]);
    const after = new Map([["salmon fillet", kg(12.1)], ["potatoes", kg(15.5)], ["sugar", kg(0.5)]]);
    expect(menuChanges(before, after, 80, 72)).toEqual({
      sentence: "72 guests instead of 80: 2 lines get smaller.",
      lines: [
        { words: "salmon fillet", from: kg(13.5), to: kg(12.1) },
        { words: "potatoes", from: kg(17), to: kg(15.5) },
      ],
    });
  });

  it("counts new and dropped lines when the dishes change", () => {
    const result = menuChanges(new Map([["fusilli", kg(8)], ["tomatoes", kg(10)]]), new Map([["rice", kg(6)], ["tomatoes", kg(9)]]), 80, 80);
    expect(result.sentence).toBe("Still 80 guests, other dishes: 1 new line, 1 line dropped.");
    expect(result.lines).toContainEqual({ words: "rice", from: kg(0), to: kg(6) });
    expect(result.lines).toContainEqual({ words: "fusilli", from: kg(8), to: kg(0) });
  });

  it("says so when nothing changes, and when lines grow", () => {
    const same = new Map([["rice", kg(6)]]);
    expect(menuChanges(same, same, 80, 80)).toEqual({ sentence: "Still 80 guests: nothing changes in the order.", lines: [] });
    expect(menuChanges(same, new Map([["rice", kg(7)]]), 80, 90).sentence).toBe("90 guests instead of 80: 1 line gets bigger.");
  });
});

describe("scaling recipes", () => {
  it("scales from the recipe's portions to the guests with the waste factor", () => {
    expect(WASTE_FACTOR).toBe(0.05);
    expect(scaled(1.2, 10, 80)).toBeCloseTo(10.08, 5);
  });

  it("rounds up to steps a kitchen measures", () => {
    expect(kitchenRound(0.42)).toBe(0.5);
    expect(kitchenRound(1.91)).toBe(2);
    expect(kitchenRound(10.08)).toBe(10.5);
    expect(kitchenRound(21.2)).toBe(22);
    expect(kitchenRound(3)).toBe(3);
    expect(kitchenRound(0)).toBe(0);
  });

  it("adds the amounts of several dishes before it rounds", () => {
    expect(total([0.21, 0.21, 0.21], "l")).toEqual({ amount: 0.7, unit: "l" });
  });
});
