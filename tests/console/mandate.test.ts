import { describe, expect, it } from "vitest";
import type { Mandate } from "@/lib/contracts";
import { allergenRule, categoryLabel, tiers } from "@/lib/console/format/mandate";
import { changedFields, draftOf, parseAmount, patchOf } from "@/lib/console/format/mandate-patch";

const mandate: Mandate = {
  id: "m1",
  version: 1,
  buyer: { id: "b", name: "Nordic Harbour Hotels", customerNumber: "123" },
  agent: { id: "a", name: "Harbour purchasing agent" },
  supplier: "Valio Aimo",
  validFrom: "2026-11-01T00:00:00Z",
  validUntil: "2026-11-30T00:00:00Z",
  limits: { perOrder: { amount: 1500, currency: "EUR" }, perWeek: { amount: 5000, currency: "EUR" } },
  categories: { allowed: ["dairy", "bakery"] },
  dietary: { excludeAllergens: ["nuts"], blockMayContain: false, requiredClaims: [] },
  substitution: { policy: "like_for_like", maxPriceIncreasePct: 10 },
  delivery: { allowPartial: false, maxDelayDays: 1 },
  approval: { approver: { id: "u", name: "Maria Lind, Head of Purchasing" }, firstTimeProducts: false },
};

describe("mandate patch", () => {
  it("sends only what changed, with lists whole", () => {
    const before = draftOf(mandate);
    const after = { ...before, perOrder: 2000, categories: ["dairy"], allowPartial: true };
    expect(changedFields(before, after)).toEqual(["perOrder", "categories", "allowPartial"]);
    expect(patchOf(before, after)).toEqual({
      limits: { perOrder: { amount: 2000, currency: "EUR" } },
      categories: { allowed: ["dairy"] },
      delivery: { allowPartial: true },
    });
  });

  it("treats a reordered list as unchanged", () => {
    const before = draftOf(mandate);
    expect(changedFields(before, { ...before, categories: ["bakery", "dairy"] })).toEqual([]);
  });

  it("reads typed amounts", () => {
    expect(parseAmount("1 500,50")).toBe(1500.5);
    expect(parseAmount("-3")).toBeUndefined();
  });
});

describe("mandate words", () => {
  it("writes allergens as rules and categories as words", () => {
    expect(allergenRule("nuts")).toBe("No nuts");
    expect(categoryLabel("dry goods")).toBe("Dry goods");
    expect(categoryLabel("produce")).toBe("Fruit and vegetables");
  });

  it("reads the mandate as three tiers", () => {
    const result = tiers(mandate);
    expect(result.alone[0]).toBe("Orders up to €1,500.00");
    expect(result.ask).toContain("Partial deliveries");
    expect(result.never[0]).toBe("Buy nuts");
  });
});
