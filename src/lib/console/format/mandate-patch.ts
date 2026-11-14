import type { Mandate } from "@/lib/contracts";
import type { MandatePatch } from "@/lib/orders/types";

/** The fields the console lets a person edit, flat so a form can hold them. */
export interface MandateDraft {
  perOrder: number;
  perWeek: number;
  categories: string[];
  allergens: string[];
  substitution: Mandate["substitution"]["policy"];
  allowPartial: boolean;
  maxDelayDays: number;
  firstTimeProducts: boolean;
}

export function draftOf(mandate: Mandate): MandateDraft {
  return {
    perOrder: mandate.limits.perOrder.amount,
    perWeek: mandate.limits.perWeek.amount,
    categories: [...mandate.categories.allowed],
    allergens: [...mandate.dietary.excludeAllergens],
    substitution: mandate.substitution.policy,
    allowPartial: mandate.delivery.allowPartial,
    maxDelayDays: mandate.delivery.maxDelayDays,
    firstTimeProducts: mandate.approval.firstTimeProducts,
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}

/** Names of the fields that differ, for the "3 changes" counter. */
export function changedFields(before: MandateDraft, after: MandateDraft): (keyof MandateDraft)[] {
  return (Object.keys(after) as (keyof MandateDraft)[]).filter((key) => {
    const a = before[key];
    const b = after[key];
    return Array.isArray(a) && Array.isArray(b) ? !sameList(a, b) : a !== b;
  });
}

/** Only the changed fields, nested the way the mandate update expects. Lists are sent whole. */
export function patchOf(before: MandateDraft, after: MandateDraft): MandatePatch {
  const changed = new Set(changedFields(before, after));
  const patch: MandatePatch = {};
  if (changed.has("perOrder") || changed.has("perWeek")) {
    patch.limits = {};
    if (changed.has("perOrder")) patch.limits.perOrder = { amount: after.perOrder, currency: "EUR" };
    if (changed.has("perWeek")) patch.limits.perWeek = { amount: after.perWeek, currency: "EUR" };
  }
  if (changed.has("categories")) patch.categories = { allowed: after.categories };
  if (changed.has("allergens")) patch.dietary = { excludeAllergens: after.allergens };
  if (changed.has("substitution")) patch.substitution = { policy: after.substitution };
  if (changed.has("allowPartial") || changed.has("maxDelayDays")) {
    patch.delivery = {};
    if (changed.has("allowPartial")) patch.delivery.allowPartial = after.allowPartial;
    if (changed.has("maxDelayDays")) patch.delivery.maxDelayDays = after.maxDelayDays;
  }
  if (changed.has("firstTimeProducts")) patch.approval = { firstTimeProducts: after.firstTimeProducts };
  return patch;
}

/** A limit typed by a person: a finite, non-negative amount in whole cents. */
export function parseAmount(text: string): number | undefined {
  const value = Number(text.replace(/[€\s]/g, "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}
