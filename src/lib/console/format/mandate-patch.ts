import type { Mandate, NeverBuyProduct } from "@/lib/contracts";
import type { MandatePatch } from "@/lib/orders/types";

/** The fields the console lets a person edit, flat so a form can hold them. */
export interface MandateDraft {
  perOrder: number;
  perWeek: number;
  categories: string[];
  allergens: string[];
  /** "May contain" counts as "contains". */
  blockMayContain: boolean;
  /** Labels every product must carry: the kind of kitchen. */
  requiredClaims: string[];
  neverBuyProducts: NeverBuyProduct[];
  neverBuyWords: string[];
  substitution: Mandate["substitution"]["policy"];
  maxPriceIncreasePct: number;
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
    blockMayContain: mandate.dietary.blockMayContain,
    requiredClaims: [...mandate.dietary.requiredClaims],
    neverBuyProducts: [...(mandate.dietary.neverBuy?.products ?? [])],
    neverBuyWords: [...(mandate.dietary.neverBuy?.words ?? [])],
    substitution: mandate.substitution.policy,
    maxPriceIncreasePct: mandate.substitution.maxPriceIncreasePct,
    allowPartial: mandate.delivery.allowPartial,
    maxDelayDays: mandate.delivery.maxDelayDays,
    firstTimeProducts: mandate.approval.firstTimeProducts,
  };
}

function key(item: unknown): string {
  return typeof item === "string" ? item : JSON.stringify(item);
}

function sameList(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.map(key).sort().join("|") === b.map(key).sort().join("|");
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
  const dietary: NonNullable<MandatePatch["dietary"]> = {};
  if (changed.has("allergens")) dietary.excludeAllergens = after.allergens;
  if (changed.has("blockMayContain")) dietary.blockMayContain = after.blockMayContain;
  if (changed.has("requiredClaims")) dietary.requiredClaims = after.requiredClaims;
  if (changed.has("neverBuyProducts") || changed.has("neverBuyWords")) dietary.neverBuy = { products: after.neverBuyProducts, words: after.neverBuyWords };
  if (Object.keys(dietary).length > 0) patch.dietary = dietary;
  if (changed.has("substitution") || changed.has("maxPriceIncreasePct")) {
    patch.substitution = {};
    if (changed.has("substitution")) patch.substitution.policy = after.substitution;
    if (changed.has("maxPriceIncreasePct")) patch.substitution.maxPriceIncreasePct = after.maxPriceIncreasePct;
  }
  if (changed.has("allowPartial") || changed.has("maxDelayDays")) {
    patch.delivery = {};
    if (changed.has("allowPartial")) patch.delivery.allowPartial = after.allowPartial;
    if (changed.has("maxDelayDays")) patch.delivery.maxDelayDays = after.maxDelayDays;
  }
  if (changed.has("firstTimeProducts")) patch.approval = { firstTimeProducts: after.firstTimeProducts };
  return patch;
}

/** The mandate as it would read once the draft is saved: what the screen explains before anyone signs it. */
export function applyDraft(mandate: Mandate, draft: MandateDraft): Mandate {
  return {
    ...mandate,
    limits: { perOrder: { amount: draft.perOrder, currency: "EUR" }, perWeek: { amount: draft.perWeek, currency: "EUR" } },
    categories: { allowed: draft.categories },
    dietary: {
      excludeAllergens: draft.allergens,
      blockMayContain: draft.blockMayContain,
      requiredClaims: draft.requiredClaims,
      neverBuy: { products: draft.neverBuyProducts, words: draft.neverBuyWords },
    },
    substitution: { policy: draft.substitution, maxPriceIncreasePct: draft.maxPriceIncreasePct },
    delivery: { allowPartial: draft.allowPartial, maxDelayDays: draft.maxDelayDays },
    approval: { ...mandate.approval, firstTimeProducts: draft.firstTimeProducts },
  };
}

/** A limit typed by a person: a finite, non-negative amount in whole cents. */
export function parseAmount(text: string): number | undefined {
  const value = Number(text.replace(/[€\s]/g, "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}
