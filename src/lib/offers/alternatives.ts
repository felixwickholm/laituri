import type { Product, Quantity } from "@/lib/contracts";
import { count, priceChangePhrase, productName, weekday } from "./format";
import { buildLine, isOnTime } from "./lines";
import { contentPerUnit, requiredContent, round } from "./packs";
import { isLikeForLike, substituteLine } from "./substitutes";
import type { BuiltLine, Market } from "./types";

export type Tier = "good" | "better" | "best";

/** One requested line and how the primary offer answered it. */
export interface Need {
  original?: Product;
  quantity: Quantity;
  primary: BuiltLine;
  candidates: Product[];
}

export interface AlternativePlan {
  tier: Tier;
  tradeoff: string;
  lines: BuiltLine[];
}

interface Option {
  lines: BuiltLine[];
  tradeoff: string;
  productId: string;
}

const PREMIUM_LABEL = /organic|finland|finnish|swan/i;

function when(built: BuiltLine): string {
  const date = built.line.availability.deliveryDate;
  return date ? `in full on ${weekday(date)}` : "in full on time";
}

function substituteSentence(built: BuiltLine, lead: string): string {
  const pct = built.line.substituteFor?.priceChangePct ?? 0;
  const from = built.product?.brand ?? built.product?.vendor ?? "another supplier";
  return `${lead} from ${from}, ${priceChangePhrase(pct)}, ${when(built)}.`;
}

function cheapest(lines: BuiltLine[]): BuiltLine | undefined {
  return [...lines].sort((a, b) => a.line.lineNet.amount - b.line.lineNet.amount)[0];
}

/** Every like-for-like candidate that covers the full need on time. */
function fullSubstitutes(need: Need, market: Market): BuiltLine[] {
  const { original } = need;
  if (!original) return [];
  const content = requiredContent(need.quantity, contentPerUnit(original, market.prices.get(original.id)));
  if (!content) return [];
  return need.candidates
    .filter((candidate) => isLikeForLike(original, candidate))
    .map((candidate) => substituteLine(original, need.primary.line, candidate, content, market))
    .filter((built): built is BuiltLine => built !== undefined);
}

function option(built: BuiltLine | undefined, lead: string): Option | undefined {
  if (!built) return undefined;
  return { lines: [built], tradeoff: substituteSentence(built, lead), productId: built.line.productId };
}

/** The available part of the original plus the cheapest like-for-like substitute for the rest. */
function split(need: Need, market: Market): Option | undefined {
  const { original, primary } = need;
  if (!original || primary.line.availability.status !== "partial") return undefined;
  const unitContent = contentPerUnit(original, market.prices.get(original.id));
  const total = requiredContent(need.quantity, unitContent);
  if (!unitContent || !total) return undefined;
  const kept = buildLine(original.id, original, primary.line.quantity, market);
  if (!isOnTime(kept.line, market.deliverBy)) return undefined;
  const rest = { amount: round(total.amount - primary.line.quantity * unitContent.amount, 3), unit: total.unit };
  const fill = cheapest(
    need.candidates
      .filter((candidate) => isLikeForLike(original, candidate))
      .map((candidate) => substituteLine(original, primary.line, candidate, rest, market))
      .filter((built): built is BuiltLine => built !== undefined),
  );
  if (!fill) return undefined;
  const tradeoff = `${count(kept.line.quantity)} units of ${productName(original)} plus ${count(fill.line.quantity)} units of ${fill.line.name}, ${when(fill)}.`;
  return { lines: [kept, fill], tradeoff, productId: fill.line.productId };
}

function mostReliable(options: BuiltLine[], exclude: Set<string>): Option | undefined {
  const ranked = options
    .filter((built) => !exclude.has(built.line.productId) && built.product?.deliveryReliability !== undefined)
    .sort((a, b) => (b.product?.deliveryReliability ?? 0) - (a.product?.deliveryReliability ?? 0));
  const best = ranked[0];
  if (!best) return undefined;
  const reliability = Math.round((best.product?.deliveryReliability ?? 0) * 100);
  return option(best, `Same product type with ${reliability} % delivery reliability`);
}

function premium(options: BuiltLine[], exclude: Set<string>): Option | undefined {
  const ranked = options
    .filter((built) => !exclude.has(built.line.productId))
    .filter((built) => built.product?.labels.some((label) => PREMIUM_LABEL.test(label)))
    .sort((a, b) => Math.abs(a.line.substituteFor?.priceChangePct ?? 0) - Math.abs(b.line.substituteFor?.priceChangePct ?? 0));
  const best = ranked[0];
  if (!best) return undefined;
  const organic = best.product?.labels.some((label) => /organic/i.test(label));
  return option(best, organic ? "Organic option of the same product type" : "Finnish-label option of the same product type");
}

/**
 * Up to three ways to cover the full need when the primary offer cannot.
 * A tier is skipped unless every problem line has a valid candidate for it.
 */
export function planAlternatives(needs: Need[], market: Market): AlternativePlan[] {
  const problems = needs.filter((need) => !isOnTime(need.primary.line, market.deliverBy));
  if (problems.length === 0) return [];
  const used = new Map<Need, Set<string>>(problems.map((need) => [need, new Set<string>()]));
  const full = new Map<Need, BuiltLine[]>(problems.map((need) => [need, fullSubstitutes(need, market)]));

  const pickers: Record<Tier, (need: Need) => Option | undefined> = {
    good: (need) => option(cheapest(full.get(need) ?? []), "Same product type"),
    better: (need) => split(need, market) ?? mostReliable(full.get(need) ?? [], used.get(need) ?? new Set()),
    best: (need) => premium(full.get(need) ?? [], used.get(need) ?? new Set()),
  };

  const plans: AlternativePlan[] = [];
  for (const tier of ["good", "better", "best"] as const) {
    const chosen = new Map<Need, Option>();
    for (const need of problems) {
      const picked = pickers[tier](need);
      if (picked) chosen.set(need, picked);
    }
    if (chosen.size !== problems.length) continue;
    for (const [need, picked] of chosen) used.get(need)?.add(picked.productId);
    plans.push({
      tier,
      tradeoff: [...chosen.values()].map((picked) => picked.tradeoff).join(" "),
      lines: needs.flatMap((need) => chosen.get(need)?.lines ?? [need.primary]),
    });
  }
  return plans;
}
