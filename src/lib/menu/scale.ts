import type { KitchenAmount } from "@/lib/contracts";

/** Kitchens lose some food to trimming, tasting and plates: 5 % on top of what the recipes say. */
export const WASTE_FACTOR = 0.05;

const EPSILON = 1e-9;

/** Rounds up to a step a kitchen would weigh or measure: 0.1 below 2, 0.5 below 20, else whole units. */
export function kitchenRound(amount: number): number {
  if (amount <= 0) return 0;
  const step = amount < 2 ? 0.1 : amount < 20 ? 0.5 : 1;
  return Math.round(Math.ceil(amount / step - EPSILON) * step * 10) / 10;
}

/** A recipe amount for its portions, scaled to the guests with the waste factor, not yet rounded. */
export function scaled(amount: number, serves: number, guests: number): number {
  return (amount / serves) * guests * (1 + WASTE_FACTOR);
}

/** Adds amounts of one unit and rounds the sum once, so small amounts from several dishes do not each round up. */
export function total(amounts: number[], unit: KitchenAmount["unit"]): KitchenAmount {
  return { amount: kitchenRound(amounts.reduce((sum, amount) => sum + amount, 0)), unit };
}
