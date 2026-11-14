import { describe, expect, it } from "vitest";
import { approachParams, contractionAt, easeFactor, ORB_STATES, orbParams, spinRate } from "@/lib/console/orb-params";
import { micLevel, smoothLevel } from "@/lib/console/orb-level";

describe("orbParams", () => {
  it("gives each state its colour", () => {
    const tones = Object.fromEntries(ORB_STATES.map((state) => [state, orbParams(state).tone]));
    expect(tones).toEqual({
      idle: "none",
      thinking: "accent",
      acting: "accent",
      approval: "warn",
      blocked: "danger",
      signed: "success",
      listening: "accent",
    });
  });

  it("turns slowly when idle, faster when thinking, and stops for approval", () => {
    expect(orbParams("idle").turnsPerMinute).toBe(1);
    expect(orbParams("thinking").turnsPerMinute).toBe(3);
    expect(orbParams("approval").turnsPerMinute).toBe(0);
  });

  it("gives each state its own motion", () => {
    expect(orbParams("thinking").band).toBe(1);
    expect(orbParams("acting").ripple).toBe(1);
    expect(orbParams("approval").rim).toBe(1);
    expect(orbParams("blocked").contraction).toBe(0.12);
    expect(orbParams("signed").sweep).toBe(1);
    expect(orbParams("listening").levelGain).toBeGreaterThan(0);
    expect(orbParams("idle").breathe).toBeGreaterThan(0);
  });
});

describe("transitions", () => {
  it("converts turns per minute to radians per second", () => {
    expect(spinRate(60)).toBeCloseTo(Math.PI * 2);
  });

  it("settles about 98% of the way in 600 ms", () => {
    expect(easeFactor(0.6)).toBeCloseTo(Math.exp(-4));
    let params = orbParams("idle");
    for (let t = 0; t < 0.6; t += 0.01) params = approachParams(params, orbParams("thinking"), 0.01);
    expect(params.turnsPerMinute).toBeGreaterThan(2.9);
    expect(params.tone).toBe("accent");
  });

  it("contracts fast and returns", () => {
    expect(contractionAt(0.12, 0)).toBe(0);
    expect(contractionAt(0.12, 0.15)).toBeCloseTo(0.12);
    expect(contractionAt(0.12, 1.5)).toBeLessThan(0.001);
    expect(contractionAt(0, 0.1)).toBe(0);
  });
});

describe("microphone level", () => {
  it("is 0 for silence and rises with loudness", () => {
    expect(micLevel(new Uint8Array(64).fill(128))).toBe(0);
    const loud = Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 168 : 88));
    expect(micLevel(loud)).toBeGreaterThan(0.9);
    expect(micLevel([])).toBe(0);
  });

  it("smooths with a 120 ms time constant", () => {
    expect(smoothLevel(0, 1, 120)).toBeCloseTo(1 - Math.exp(-1));
    expect(smoothLevel(0.5, 0.5, 16)).toBe(0.5);
  });
});
