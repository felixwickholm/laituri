import { afterEach, describe, expect, it, vi } from "vitest";
import { createModelBudget } from "@/lib/agent/llm/budget";
import { modelWordsReader } from "@/lib/menu/model-reader";

const WINDOW_MS = 10 * 60_000;

function setup(perDay = 5, perAddress = 2) {
  const clock = { now: Date.parse("2026-11-14T09:00:00Z") };
  return { budget: createModelBudget({ perDay: () => perDay, perAddress: () => perAddress, windowMs: WINDOW_MS, clock: () => clock.now }), clock };
}

describe("the shared model-call budget", () => {
  it("limits each client address in a window", () => {
    const { budget, clock } = setup();
    expect([budget.admit("a"), budget.admit("a"), budget.admit("a")]).toEqual([true, true, false]);
    expect(budget.admit("b")).toBe(true);
    clock.now += WINDOW_MS;
    expect(budget.admit("a")).toBe(true);
  });

  it("stops every address once the day's budget is spent, and starts again the next day", () => {
    const { budget, clock } = setup(3, 10);
    expect(["a", "b", "c", "d"].map((address) => budget.admit(address))).toEqual([true, true, true, false]);
    expect(budget.usedToday()).toBe(3);
    clock.now += 24 * 3600_000;
    expect(budget.admit("d")).toBe(true);
  });
});

describe("the menu planner's model reading", () => {
  const holder = globalThis as typeof globalThis & { __laituriModelBudget?: unknown };
  afterEach(() => {
    delete holder.__laituriModelBudget;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("falls back to the rules without calling the model once the budget is spent", async () => {
    vi.stubEnv("LAITURI_AGENT_ENGINE", "claude");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    holder.__laituriModelBudget = { admit: () => false, usedToday: () => 0 };
    const reader = modelWordsReader();
    expect(reader).toBeDefined();
    expect(await reader!("A wedding for 80 on 2026-12-05", "2026-11-14")).toBeUndefined();
    expect(network).not.toHaveBeenCalled();
  });
});
