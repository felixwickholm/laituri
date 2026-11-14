import { RuleId } from "@/lib/contracts";
import { describe, expect, it } from "vitest";
import { ORB_STATES } from "@/lib/console/orb-params";
import { STORY, STORY_LENGTH_MS, storyFrame, storyFrameFor } from "@/lib/console/orb-story";
import { arcPath, arcStatus } from "@/components/orb/Seal";

describe("the landing orb story", () => {
  it("runs its beats in order and ends waiting for Maria", () => {
    const times = STORY.map((beat) => beat.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(STORY.at(-1)?.state).toBe("approval");
    expect(STORY.at(-1)?.caption).toContain("€116.00 over the €1,500.00 per-order limit");
  });

  it("fills the rules arc by arc while checking", () => {
    const checking = STORY.findIndex((beat) => beat.caption.startsWith("Checking"));
    const start = STORY[checking].at;
    const end = STORY[checking + 1].at;
    expect(storyFrame(start).rulesPassed).toBe(0);
    expect(storyFrame((start + end) / 2).rulesPassed).toBe(Math.round(RuleId.options.length / 2));
    expect(storyFrame(end - 1).rulesPassed).toBe(RuleId.options.length);
  });

  it("loops", () => {
    expect(storyFrame(STORY_LENGTH_MS + 10)).toEqual(storyFrame(10));
  });

  it("has a still frame for every state", () => {
    for (const state of ORB_STATES) expect(storyFrameFor(state).state).toBe(state);
  });
});

describe("the seal", () => {
  it("fills passed rules and marks the rule that stopped the order", () => {
    expect(arcStatus(2, 5, "thinking")).toBe("pass");
    expect(arcStatus(5, 5, "approval")).toBe("ask");
    expect(arcStatus(5, 5, "blocked")).toBe("fail");
    expect(arcStatus(6, 5, "blocked")).toBe("todo");
  });

  it("draws arcs clockwise from the top", () => {
    expect(arcPath(0, 90, 10)).toBe("M 100.00 90.00 A 10 10 0 0 1 110.00 100.00");
  });
});
