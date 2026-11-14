import { describe, expect, it, vi } from "vitest";
import { recommendedMenu } from "@/lib/assistant/cards";
import { plan } from "./support";

// A library with no main course at all: every menu is incomplete.
vi.mock("@/lib/recipes", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/recipes")>();
  return { ...original, PLANNER_RECIPES: original.PLANNER_RECIPES.filter((recipe) => recipe.course !== "main") };
});

describe("a plan where no main course fits", () => {
  it("says so in a false fit on every menu and suggests none of them", async () => {
    const result = await plan({ words: "Dinner for 40 on Friday" });
    expect(result.menus.length).toBeGreaterThan(0);
    for (const menu of result.menus) {
      expect(menu.courses.some((course) => course.course === "main")).toBe(false);
      expect(menu.fits[0]).toEqual({ ok: false, sentence: "No main course fits your rules." });
    }
    expect(recommendedMenu(result, { guests: 40, dietary: [] })).toBeUndefined();
  });
});
