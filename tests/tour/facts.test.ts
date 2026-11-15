import { describe, expect, it } from "vitest";
import type { Basket, BasketLine } from "@/lib/contracts";
import { CONDITIONS, lineWhy, narrate, tourBasket, tourFacts } from "@/lib/tour/facts";
import { MAIN_TARGET, STEPS, copyOf, routeOf, spotGroups } from "@/lib/tour/steps";

function line(id: string, state: BasketLine["state"], patch: Partial<BasketLine> = {}): BasketLine {
  return { id, words: id, asked: { amount: 1, unit: "kg" }, state, reason: "Ordered. Inside your limits.", ...patch };
}

function basket(lines: BasketLine[], patch: Partial<Basket> = {}): Basket {
  const count = (state: BasketLine["state"]) => lines.filter((item) => item.state === state).length;
  return {
    id: "bsk_1",
    title: "Weekly order for Monday",
    source: "weekly",
    buyer: { id: "b", name: "Nordic Harbour Hotels" },
    deliverBy: "2026-11-16",
    createdAt: "2026-11-14T10:00:00.000Z",
    status: count("working") > 0 ? "running" : "done",
    lines,
    totals: { lines: lines.length, green: count("green"), orange: count("orange"), red: count("red"), working: count("working"), netOrdered: 0, netWaiting: 0, minutesByHand: lines.length },
    summary: "",
    ...patch,
  };
}

const step = (id: string) => STEPS.find((item) => item.id === id) as (typeof STEPS)[number];
const greens = Array.from({ length: 17 }, (_, index) => line(`g${index}`, "green"));
const nuts = line("Alpro almond drink", "red", {
  reasonCode: "allergen",
  reason: "Contains nuts. Your rules say no.",
  options: [{ id: "s", kind: "substitute", label: "Take Alpro Rice drink 1L instead" }],
});
const butter = line("butter", "orange", { reasonCode: "over_limit", reason: "€150 over your order limit." });
const uht = line("lactose-free UHT skimmed milk", "orange", { reasonCode: "substitute_needs_ok", reason: "Only 51 in stock. The swap is not UHT." });
const weekly = basket([...greens, butter, uht, nuts]);

describe("the tour's facts", () => {
  it("follows the basket the tour started, else the newest weekly one once the tour began", () => {
    const history = basket([], { id: "old", seeded: true });
    expect(tourBasket([weekly, history], "bsk_1", undefined)?.id).toBe("bsk_1");
    expect(tourBasket([history, weekly], undefined, "2026-11-14")?.id).toBe("bsk_1");
    expect(tourBasket([history], undefined, "2026-11-14")).toBeUndefined();
    expect(tourBasket([weekly], undefined, undefined)).toBeUndefined();
  });

  it("reads every number and every reason from the basket", () => {
    const facts = tourFacts(weekly, false);
    expect(facts).toMatchObject({ lines: 20, alone: 17, needed: 2, red: 1, done: true, swap: "Alpro Rice drink 1L" });
    expect(copyOf(step("basket"), facts, true).title).toBe("17 of 20 lines ordered alone.");
    expect(copyOf(step("needs"), facts, true)).toEqual({
      title: "Why 2 lines need a person",
      detail: "Butter: €150 over the customer’s order limit. Lactose-free UHT skimmed milk: only 51 in stock. The swap is not UHT.",
    });
    expect(copyOf(step("blocked"), facts, true)).toEqual({
      title: "Why 1 line is blocked",
      detail: "Alpro almond drink contains nuts. The customer’s own rule says never. A safe swap is offered: Alpro Rice drink 1L.",
    });
  });

  it("tells the product's sentences about the customer, keeping an acronym's capitals", () => {
    expect(narrate("Your rules say no.")).toBe("The customer’s rules say no.");
    expect(lineWhy(line("cream", "orange", { reason: "UHT only in stock." }))).toBe("Cream: UHT only in stock.");
  });

  it("never describes what is not on screen yet", () => {
    const empty = tourFacts(undefined, false);
    expect(copyOf(step("basket"), empty, false).title).toBe("Now the weekly order.");
    const working = tourFacts(basket([...greens.slice(0, 3), line("w", "working")]), false);
    expect(copyOf(step("basket"), working, false).title).toBe("The agent works through 4 lines.");
    expect(copyOf(step("needs"), working, false).title).toBe("Some lines need a person.");
    expect(copyOf(step("blocked"), working, false).title).toBe("The agent checks every line.");
    expect(copyOf(step("example"), empty, false).title).toBe("The challenge’s own example.");
    expect(copyOf(step("example"), empty, true).title).toBe("The challenge’s own example.");
    expect(copyOf(step("example"), tourFacts(undefined, false, "alone"), true).title).toBe("Request, lookup, order. No person needed.");
    expect(copyOf(step("example"), tourFacts(undefined, false, "waits"), true).title).toBe("Request, lookup, order. Now a person approves.");
  });

  it("says a person decided as soon as one waiting line is resolved, and keeps the count of lines that needed one", () => {
    const answered = basket([...greens, { ...butter, state: "green", resolved: { optionId: "a", by: "Maria", at: "x", sentence: "Approved." } }, uht, nuts]);
    expect(tourFacts(answered, false)).toMatchObject({ alone: 17, needed: 2 });
    expect(copyOf(step("phone"), tourFacts(answered, false), true).title).toBe("Done. A person decided.");
    expect(copyOf(step("needs"), tourFacts(answered, false), true).detail).toContain("Butter: €150 over");
  });

  it("words a red line by why it is red, and admits when nothing was blocked", () => {
    const late = basket([line("cream", "red", { reasonCode: "no_stock_in_time", reason: "Not in stock by Monday." })]);
    expect(copyOf(step("blocked"), tourFacts(late, false), true).detail).toBe("Cream cannot arrive in time.");
    expect(copyOf(step("blocked"), tourFacts(basket(greens), false), false).title).toBe("No line is blocked this time.");
  });

  it("waits for each result with a plain condition", () => {
    const facts = tourFacts(weekly, true);
    expect(CONDITIONS.basketDone(facts)).toBe(true);
    expect(CONDITIONS.needsPerson(facts)).toBe(true);
    expect(CONDITIONS.blocked(facts)).toBe(true);
    expect(CONDITIONS.basketDone(tourFacts(undefined, false))).toBe(false);
  });
});

describe("the fallbacks", () => {
  it("lights the page's main region when a step's own hook is missing", () => {
    for (const item of STEPS) {
      const [first] = spotGroups(item);
      expect(first.at(-1)).toBe(MAIN_TARGET);
      expect(first.length).toBeGreaterThan(1);
    }
  });

  it("types the wedding example to the assistant, then shows the menus, on the planner", () => {
    expect(routeOf(step("ask"), {})).toBe("/buyer/plan");
    expect(step("ask").enter).toBe("typeEvent");
    expect(routeOf(step("plan"), {})).toBe("/buyer/plan");
    expect(step("plan").enter).toBe("planEvent");
  });

  it("falls back to the step's first card when a number is not known", () => {
    const copy = copyOf(step("basket"), { done: true, neededLines: [], recordBroken: false }, true);
    expect(copy.title).toBe("Now the weekly order.");
  });

  it("drives the real product through the shared hooks", () => {
    const selectors = STEPS.flatMap((item) => [...item.target, ...(item.also ?? [])]).join(" ");
    for (const hook of ["milk-result", "basket", "basket-line", "valio-agents", "record-seal"]) {
      expect(selectors).toContain(`data-tour="${hook}"`);
    }
  });
});
