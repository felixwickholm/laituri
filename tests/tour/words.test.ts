import { describe, expect, it } from "vitest";
import { LIMITS, fill, fillCopy, wordCount, withinLimits, type StepCopy } from "@/lib/tour/copy";
import { END, INTRO, STEPS } from "@/lib/tour/steps";

/** The product's own words, as long as a fresh sandbox gives them. */
const WORDS = {
  needWhy: "Butter: €150 over the customer’s order limit. Lactose-free UHT skimmed milk: only 51 in stock. The swap is not UHT.",
  redName: "Alpro almond drink",
  redWhy: "Alpro almond drink: contains nuts. The customer’s rules say no.",
  swapLine: " A safe swap is offered: Alpro Rice drink 1L.",
};

/** Every count a card can quote, at the values that change its words: one, a few, many. */
const SAMPLES = [1, 2, 17, 20].map((n) => ({ lines: n, alone: n, needed: n, red: n, steps: STEPS.length, ...WORDS }));

function cards(): { where: string; copy: StepCopy }[] {
  const all: { where: string; copy: StepCopy }[] = [];
  for (const step of STEPS) {
    for (const [name, words] of Object.entries(step.words)) {
      for (const counts of SAMPLES) {
        const copy = fillCopy(words, counts);
        expect(copy, `${step.id}.${name} names a fact the tour does not have`).toBeDefined();
        all.push({ where: `${step.id}.${name}`, copy: copy as StepCopy });
      }
    }
    // The note that replaces the sentence when a result is late still fits the card.
    all.push({ where: `${step.id}.late`, copy: { title: Object.values(step.words)[0].title, detail: step.late } });
  }
  all.push({ where: "intro", copy: fillCopy(INTRO, SAMPLES[0]) as StepCopy });
  all.push({ where: "end", copy: { title: END.title } });
  return all;
}

describe("the walkthrough's words", () => {
  it("counts words as a reader does", () => {
    expect(wordCount("1 line is blocked.")).toBe(4);
    expect(wordCount("One tap. The agent does the rest.")).toBe(7);
    expect(wordCount("It has nuts. The customer’s rules say no.")).toBe(8);
  });

  it("keeps every card to a headline of 8 words and about 30 words in all", () => {
    for (const { where, copy } of cards()) {
      expect(wordCount(copy.title), `${where}: "${copy.title}"`).toBeLessThanOrEqual(LIMITS.title);
      if (copy.detail) expect(wordCount(copy.detail), `${where}: "${copy.detail}"`).toBeLessThanOrEqual(LIMITS.detail);
      expect(withinLimits(copy), where).toBe(true);
    }
  });

  it("has 10 to 13 steps that cover every part, in order, and three ways on at the end", () => {
    expect(STEPS.length).toBeGreaterThanOrEqual(10);
    expect(STEPS.length).toBeLessThanOrEqual(13);
    expect(STEPS.map((step) => step.id)).toEqual(["today", "example", "basket", "needs", "phone", "blocked", "limits", "shop", "plan", "valio", "demand", "security", "record"]);
    expect(END.choices.map((choice) => choice.label)).toEqual(["Try it yourself", "Plan an event", "Connect your own agent"]);
  });

  it("never types a number into a card: every figure is a fact", () => {
    for (const step of STEPS) {
      for (const words of Object.values(step.words)) expect(`${words.title} ${words.detail ?? ""}`).not.toMatch(/\d/);
    }
  });

  it("picks the singular word for one", () => {
    expect(fill("{red} {red?line is:lines are} blocked.", { red: 1 })).toBe("1 line is blocked.");
    expect(fill("{red} {red?line is:lines are} blocked.", { red: 3 })).toBe("3 lines are blocked.");
    expect(fill("{red} lines", {})).toBeUndefined();
  });

  it("says no chat words, no cheating and no disclaimers, and names the sides Customer and Valio Aimo", () => {
    for (const { copy } of cards()) {
      const text = `${copy.title} ${copy.detail ?? ""}`;
      expect(text).not.toMatch(/\bchat/i);
      expect(text).not.toMatch(/cheat|break it|prototype|not real|kitchen/i);
    }
    expect(INTRO.title).toBe("Demo walkthrough");
  });
});
