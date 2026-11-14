import { describe, expect, it } from "vitest";
import { EXAMPLE_LINES, EXAMPLE_REQUEST, FIRST_MS, LOOP_MS, STEP_MS, exampleFrame, finalFrame } from "@/components/landing/example-basket";

describe("the hero's example basket", () => {
  it("quotes the challenge sheet's own example sentence", () => {
    expect(EXAMPLE_REQUEST).toBe("I need 1,000 litres of lactose-free milk by Monday.");
    expect(EXAMPLE_LINES[0]).toMatchObject({ words: "lactose-free milk", asked: { amount: 1000, unit: "l" } });
  });

  it("starts with every line at work and the agent thinking", () => {
    const frame = exampleFrame(0);
    expect(frame.counts.working).toBe(EXAMPLE_LINES.length);
    expect(frame.orb).toBe("thinking");
  });

  it("finishes the lines one by one, in order", () => {
    const frame = exampleFrame(FIRST_MS + STEP_MS);
    expect(frame.lines.slice(0, 2).map((line) => line.state)).toEqual(EXAMPLE_LINES.slice(0, 2).map((line) => line.state));
    expect(frame.lines[2].state).toBe("working");
    expect(frame.orb).toBe("acting");
  });

  it("ends with all three outcomes, each shown as colour, word and shape, and the agent waiting for a person", () => {
    const frame = finalFrame();
    expect(frame.counts).toEqual({ green: 4, orange: 1, red: 1, working: 0 });
    expect(frame.orb).toBe("approval");
  });

  it("loops", () => {
    expect(exampleFrame(LOOP_MS)).toEqual(exampleFrame(0));
  });

  it("speaks in the product's plain line reasons", () => {
    for (const line of EXAMPLE_LINES) expect(line.reason.split(/\s+/).length).toBeLessThanOrEqual(14);
  });
});
