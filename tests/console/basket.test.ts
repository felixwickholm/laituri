import { describe, expect, it } from "vitest";
import {
  basketVerdict,
  changeNote,
  currentBasket,
  draftLead,
  draftRequest,
  groupLines,
  handoffContext,
  isEventRequest,
  isWeeklyRequest,
  limitUsed,
  moreOptions,
  primaryOption,
  timeSaved,
  workingCaption,
} from "@/lib/console/basket";
import { mergeBasket } from "@/lib/console/basket-store";
import { basketOrbView } from "@/lib/console/orb-state";
import type { WeeklyDraft } from "@/lib/contracts";
import { basketOf } from "./fixtures";

const NOW = Date.parse("2026-11-14T10:00:00.000Z");

describe("a basket in plain words", () => {
  it("says what the agent did, then what needs a person, then what is blocked", () => {
    expect(basketVerdict(basketOf(["green", "green", "orange", "orange", "red"]))).toBe("Your agent ordered 2 lines. 2 need you. 1 is blocked.");
    expect(basketVerdict(basketOf(["green", "green"]))).toBe("Your agent ordered all 2 lines.");
    expect(basketVerdict(basketOf(["green", "working", "working"]))).toBe("Your agent is working on 3 lines. 1 is done.");
  });

  it("counts the time it took against the time by hand", () => {
    expect(timeSaved({ secondsTaken: 8.2, minutesByHand: 20 }, false)).toBe("Done in 8 s. About 20 min by hand.");
    expect(timeSaved({ minutesByHand: 20 }, true)).toBe("About 20 min by hand.");
  });

  it("says the weekly limit in whole euros", () => {
    expect(limitUsed(3240.4, 9000)).toBe("€3,240 of your €9,000 weekly limit used.");
  });

  it("follows the line the agent works on", () => {
    expect(workingCaption(basketOf(["green", "orange", "working", "working"]))).toBe("Working on line 3 of 4.");
  });
});

describe("lines", () => {
  it("groups what needs a person first", () => {
    const groups = groupLines(basketOf(["green", "red", "orange", "working"]).lines);
    expect(groups.needsYou.map((line) => line.state)).toEqual(["orange"]);
    expect(groups.blocked).toHaveLength(1);
    expect(groups.ordered).toHaveLength(1);
    expect(groups.working).toHaveLength(1);
  });

  it("puts the first option on the button and the rest behind More, hand-off left to the screen", () => {
    const [line] = basketOf(["orange"]).lines;
    expect(primaryOption(line)?.label).toBe("Approve");
    expect(moreOptions(line).map((option) => option.label)).toEqual(["Leave it out"]);
  });

  it("fills in the hand-off context for the person", () => {
    expect(handoffContext({ words: "almond flour", asked: { amount: 20, unit: "kg" }, state: "red", reason: "Contains nuts. Your rules say no." })).toBe(
      "Line: 20 kg almond flour. Blocked: contains nuts. Your rules say no.",
    );
  });
});

describe("routing a sentence", () => {
  it("sends events and guests to the planner", () => {
    expect(isEventRequest("Plan a dinner for 80 on Friday")).toBe(true);
    expect(isEventRequest("A wedding with 120 guests in June")).toBe(true);
    expect(isEventRequest("I need 1,000 litres of lactose-free milk by Monday.")).toBe(false);
  });

  it("starts the weekly order from its own words", () => {
    expect(isWeeklyRequest("Order this week’s lines")).toBe(true);
    expect(isWeeklyRequest("order 20 kg flour")).toBe(false);
  });
});

describe("which basket leads Today", () => {
  it("takes a running basket, else this week's weekly order", () => {
    const old = basketOf(["green"], { id: "old", createdAt: "2026-11-02T08:00:00.000Z" });
    const week = basketOf(["green"], { id: "week" });
    const running = basketOf(["working"], { id: "run", source: "menu", createdAt: "2026-11-13T08:00:00.000Z" });
    expect(currentBasket([old, week], NOW)?.id).toBe("week");
    expect(currentBasket([old, week, running], NOW)?.id).toBe("run");
    expect(currentBasket([old], NOW)).toBeUndefined();
  });

  it("keeps the list newest first when a basket changes", () => {
    const a = basketOf(["green"], { id: "a", createdAt: "2026-11-13T08:00:00.000Z" });
    const b = basketOf(["green"], { id: "b" });
    expect(mergeBasket([a], b).map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("the weekly draft", () => {
  const draft: WeeklyDraft = {
    title: "Weekly order",
    deliverBy: "2026-11-16",
    cutoff: "2026-11-15T15:00:00.000Z",
    lines: [
      { words: "lactose-free milk", quantity: { amount: 1000, unit: "l" }, lastWeek: { amount: 900, unit: "l" }, change: "more" },
      { words: "cream", quantity: { amount: 40, unit: "l" }, change: "new" },
      { words: "eggs", quantity: { amount: 36, unit: "kg" }, lastWeek: { amount: 36, unit: "kg" }, change: "same" },
    ],
    drift: [{ sentence: "Cream is up 40% in four weeks." }],
  };

  it("leads with the day, the lines and when it closes", () => {
    expect(draftLead(draft)).toBe("Your Monday order is ready: 3 lines. Closes Sunday 17:00.");
  });

  it("notes only what moved", () => {
    expect(draft.lines.map(changeNote)).toEqual(["Last week 900 l.", "New this week.", undefined]);
  });

  it("applies the person's edits and drops what they left out", () => {
    const body = draftRequest(draft, { 0: { amount: 800 }, 1: { removed: true } });
    expect(body.source).toBe("manual");
    expect(body.lines).toEqual([
      { words: "lactose-free milk", quantity: { amount: 800, unit: "l" } },
      { words: "eggs", quantity: { amount: 36, unit: "kg" } },
    ]);
  });
});

describe("the orb over a basket", () => {
  it("fills line by line, then takes the basket's colour", () => {
    expect(basketOrbView(basketOf(["green", "working", "working", "working"]))).toMatchObject({ state: "acting", caption: "Working on line 2 of 4.", rulesPassed: 1, rulesTotal: 4 });
    expect(basketOrbView(basketOf(["green", "orange", "orange"]))).toMatchObject({ state: "approval", caption: "2 lines need you." });
    expect(basketOrbView(basketOf(["green", "red"]))).toMatchObject({ state: "signed", caption: "Ordered 1 of 2 lines. 1 is blocked." });
  });
});
