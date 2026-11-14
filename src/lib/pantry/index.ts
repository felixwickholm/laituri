import type { PantryItem } from "@/lib/contracts";
import { BUYER_IDS } from "@/lib/mandate";

/** A demo stock line, with what the kitchen uses of it in a normal week. */
export interface StockLine extends PantryItem {
  weeklyUse: number;
}

/**
 * Demo stock in each kitchen, in the words the recipes use. Simulated: a real kitchen would connect its own stock
 * system here. Amounts are set so the demo shows both "already in stock" and "running low".
 */
const DEMO_STOCK: Record<string, StockLine[]> = {
  [BUYER_IDS.nordicHarbour]: [
    { words: "rice", amount: 4, unit: "kg", weeklyUse: 12 },
    { words: "potatoes", amount: 25, unit: "kg", weeklyUse: 60 },
    { words: "rapeseed oil", amount: 6, unit: "l", weeklyUse: 5 },
    { words: "sugar", amount: 3, unit: "kg", weeklyUse: 4 },
    { words: "wheat flour", amount: 5, unit: "kg", weeklyUse: 4 },
    { words: "onions", amount: 3, unit: "kg", weeklyUse: 8 },
    { words: "lactose-free milk", amount: 25, unit: "l", weeklyUse: 40 },
  ],
  [BUYER_IDS.kaisla]: [
    { words: "potatoes", amount: 40, unit: "kg", weeklyUse: 120 },
    { words: "rice", amount: 20, unit: "kg", weeklyUse: 25 },
    { words: "carrots", amount: 8, unit: "kg", weeklyUse: 30 },
    { words: "rapeseed oil", amount: 10, unit: "l", weeklyUse: 8 },
    { words: "lactose-free milk", amount: 30, unit: "l", weeklyUse: 150 },
  ],
  [BUYER_IDS.laine]: [
    { words: "potatoes", amount: 8, unit: "kg", weeklyUse: 15 },
    { words: "lactose-free butter", amount: 1, unit: "kg", weeklyUse: 3 },
    { words: "sugar", amount: 2, unit: "kg", weeklyUse: 1 },
    { words: "rapeseed oil", amount: 3, unit: "l", weeklyUse: 2 },
  ],
};

/** The kitchen's stock lines with weekly use, for the suggestions. */
export function stockLines(buyerId: string): StockLine[] {
  return DEMO_STOCK[buyerId] ?? [];
}

/** What the kitchen has in stock, as the pantry route shows it. */
export function pantryFor(buyerId: string): PantryItem[] {
  return stockLines(buyerId).map(({ words, amount, unit }) => ({ words, amount, unit }));
}
