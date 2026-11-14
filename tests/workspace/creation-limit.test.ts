import { describe, expect, it } from "vitest";
import { createCreationLimit } from "@/lib/workspace/creation-limit";

const WINDOW_MS = 10 * 60_000;

function setup(max = 2) {
  const clock = { now: 0 };
  return { limit: createCreationLimit({ max: () => max, windowMs: WINDOW_MS, clock: () => clock.now }), clock };
}

describe("sandbox creation limit per client address", () => {
  it("admits up to the limit in one window, then says when to try again", () => {
    const { limit, clock } = setup();
    expect(limit.admit("203.0.113.7")).toEqual({ allowed: true });
    expect(limit.admit("203.0.113.7")).toEqual({ allowed: true });
    clock.now = 4 * 60_000;
    expect(limit.admit("203.0.113.7")).toEqual({ allowed: false, retryAfterS: 360 });
  });

  it("counts each address on its own", () => {
    const { limit } = setup(1);
    expect(limit.admit("203.0.113.7").allowed).toBe(true);
    expect(limit.admit("203.0.113.8").allowed).toBe(true);
    expect(limit.admit("203.0.113.7").allowed).toBe(false);
  });

  it("starts a new window once the old one has passed", () => {
    const { limit, clock } = setup(1);
    limit.admit("203.0.113.7");
    clock.now = WINDOW_MS;
    expect(limit.admit("203.0.113.7").allowed).toBe(true);
  });
});
