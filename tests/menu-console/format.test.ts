import { describe, expect, it } from "vitest";
import {
  amountText,
  basketLines,
  basketQuantity,
  basketTitle,
  changesText,
  courseIndex,
  courseOf,
  deliverByFor,
  groupLines,
  planFromQuery,
  planQuery,
  recipeLines,
  scaleAmount,
  servedOrder,
  suggestionAction,
} from "@/lib/menu-console/format";
import type { MenuOption, Recipe, ShoppingLine, Suggestion } from "@/lib/menu-console/types";

function ingredient(words: string, amount = 1): Recipe["ingredients"][number] {
  return { words, amount, unit: "kg", role: "base", purpose: "", allergens: [] };
}

function line(words: string, extra: Partial<ShoppingLine> = {}): ShoppingLine {
  return {
    words,
    quantity: { amount: 10, unit: "kg" },
    toOrder: { amount: 10, unit: "kg" },
    availability: "ok",
    ...extra,
  };
}

function option(shoppingList: ShoppingLine[]): MenuOption {
  return {
    id: "menu-1",
    tier: "better",
    name: "Wedding classic",
    tagline: "",
    courses: [
      { course: "dessert", recipe: { id: "cake", name: "Cream cake", serves: 12, allergens: [], labels: [], course: "dessert" } },
      { course: "starter", recipe: { id: "soup", name: "Soup", serves: 10, allergens: [], labels: [], course: "starter" } },
      { course: "main", recipe: { id: "bolo", name: "Bolognese", serves: 10, allergens: [], labels: [], course: "main" } },
    ],
    costPerGuest: 12.4,
    totalNet: 992,
    toOrderNet: 640,
    fits: [],
    shoppingList,
    warnings: [],
  };
}

describe("basket lines from a menu", () => {
  it("orders only what the kitchen lacks, with the product it priced", () => {
    const lines = basketLines(
      option([
        line("Minced beef", { product: { id: "p1", name: "BEEF", displayName: "Beef" } }),
        line("Salt", { toOrder: { amount: 0, unit: "kg" } }),
      ]),
    );
    expect(lines).toEqual([{ words: "Minced beef", quantity: { amount: 10, unit: "kg" }, productId: "p1" }]);
  });

  it("takes the swap and its priced product unless the person refused it", () => {
    const menu = option([line("Cream", { swap: { words: "Oat cream", reason: "Oat cream works here." }, product: { id: "oat", name: "OAT CREAM", displayName: "Oat cream" } })]);
    expect(basketLines(menu)[0]).toEqual({ words: "Oat cream", quantity: { amount: 10, unit: "kg" }, productId: "oat" });
    expect(basketLines(menu, { Cream: "refused" })[0]).toEqual({ words: "Cream", quantity: { amount: 10, unit: "kg" } });
  });

  it("never orders a swap that leaves the item out", () => {
    const menu = option([line("Cheese", { swap: { words: "leave it out", reason: "Leave the cheese out." } })]);
    expect(basketLines(menu)).toEqual([]);
    expect(basketLines(menu, { Cheese: "refused" })).toEqual([{ words: "Cheese", quantity: { amount: 10, unit: "kg" } }]);
  });

  it("turns grams and decilitres into the basket's units", () => {
    expect(basketQuantity({ amount: 2500, unit: "g" })).toEqual({ amount: 2.5, unit: "kg" });
    expect(basketQuantity({ amount: 15, unit: "dl" })).toEqual({ amount: 1.5, unit: "l" });
    expect(basketQuantity({ amount: 3, unit: "box" })).toEqual({ amount: 3, unit: "pcs" });
    expect(basketQuantity({ amount: 1.23456, unit: "kg" })).toEqual({ amount: 1.235, unit: "kg" });
  });
});

describe("event facts", () => {
  const event = { guests: 80, date: "2026-11-21", occasion: "wedding dinner", dietary: ["nut_free"] };

  it("delivers the day before the event, never in the past", () => {
    expect(deliverByFor({ event }, "2026-11-14")).toBe("2026-11-20");
    expect(deliverByFor({ event: { ...event, date: "2026-11-14" } }, "2026-11-14")).toBe("2026-11-14");
    // Tomorrow's event: the day before is today, so the goods come on the day itself, as the planner says.
    expect(deliverByFor({ event: { ...event, date: "2026-11-15" } }, "2026-11-14")).toBe("2026-11-15");
    expect(deliverByFor({ event: { ...event, date: "2026-11-15" }, deliverBy: "2026-11-15" }, "2026-11-14")).toBe("2026-11-15");
  });

  it("titles the basket after the event", () => {
    expect(basketTitle({ event })).toBe("Wedding dinner, Sat 21 Nov, 80 guests");
  });

  it("says what a re-plan changed", () => {
    expect(changesText({ changes: { sentence: "72 guests instead of 80: 9 lines get smaller.", lines: [] } }, 72, 80)).toBe(
      "72 guests instead of 80: 9 lines get smaller.",
    );
    expect(changesText({}, 72, 80)).toBe("72 guests instead of 80.");
    expect(changesText({}, 80, 80)).toBeUndefined();
  });
});

describe("menus and recipes", () => {
  it("serves courses in menu order", () => {
    expect(servedOrder(option([]).courses).map((c) => c.course)).toEqual(["starter", "main", "dessert"]);
  });

  it("groups lines by the course whose recipe uses them, shared items under the first", () => {
    const index = courseIndex([
      { course: "dessert", ingredients: [ingredient("Cream"), ingredient("Butter")] },
      { course: "main", ingredients: [ingredient("Beef"), ingredient("butter")] },
    ]);
    const groups = groupLines([line("Cream"), line("Salt"), line("Beef"), line("Butter")], index);
    expect(groups.map((g) => [g.label, g.lines.map((l) => l.words)])).toEqual([
      ["Main", ["Beef", "Butter"]],
      ["Dessert", ["Cream"]],
      ["Other", ["Salt"]],
    ]);
    expect(groupLines([line("Salt")]).map((g) => g.label)).toEqual(["Everything"]);
    const sorted = groupLines([line("Salt", { toOrder: { amount: 0, unit: "kg" } }), line("Beef")]);
    expect(sorted[0].lines.map((l) => l.words)).toEqual(["Beef", "Salt"]);
  });

  it("scales a recipe to the portions asked", () => {
    expect(scaleAmount(1.2, 10, 80)).toBe(9.6);
    expect(scaleAmount(30, 10, 80)).toBe(240);
    const lines = recipeLines({ serves: 10, ingredients: [ingredient("Pasta", 1)] }, 40);
    expect(lines).toEqual([{ words: "Pasta", quantity: { amount: 4, unit: "kg" } }]);
  });

  it("reads a course from the labels when the recipe has none", () => {
    expect(courseOf({ labels: ["Dessert", "classic"] })).toBe("dessert");
    expect(courseOf({ labels: ["classic"] })).toBeUndefined();
  });

  it("writes amounts with a non-breaking space", () => {
    expect(amountText({ amount: 12, unit: "kg" })).toBe("12 kg");
  });
});

describe("planner links", () => {
  it("round-trips words and details through the query string", () => {
    expect(planQuery({ words: "Dinner for 80" })).toBe("?words=Dinner+for+80");
    const query = planQuery({ guests: 80, date: "2026-11-20", dietary: ["nut_free"] });
    expect(planFromQuery(new URLSearchParams(query))).toEqual({ guests: 80, date: "2026-11-20", dietary: ["nut_free"] });
    expect(planFromQuery(new URLSearchParams(""))).toBeUndefined();
  });
});

describe("suggestion actions", () => {
  const base: Omit<Suggestion, "kind" | "action"> = { id: "s", headline: "h", sentence: "s" };

  it("starts the weekly order or plans a menu", () => {
    expect(suggestionAction({ ...base, kind: "weekly_due", action: { type: "start_weekly" } })?.kind).toBe("start_weekly");
    expect(suggestionAction({ ...base, kind: "event", action: { type: "plan_menu", payload: { words: "Dinner for 80" } } })).toEqual({
      kind: "link",
      label: "Plan the menu",
      href: "/buyer/plan?words=Dinner+for+80",
    });
  });

  it("asks for one line when the pantry runs low", () => {
    const action = suggestionAction({ ...base, kind: "low_pantry", action: { type: "ask", payload: { words: "Rice", quantity: { amount: 20, unit: "kg" } } } });
    expect(action).toMatchObject({ kind: "ask", line: { words: "Rice", quantity: { amount: 20, unit: "kg" } } });
  });

  it("only opens a seasonal idea, never orders it", () => {
    const action = suggestionAction({ ...base, kind: "seasonal", action: { type: "ask", payload: { words: "Kale", quantity: { amount: 5, unit: "kg" } } } });
    expect(action?.kind).toBe("link");
  });
});
