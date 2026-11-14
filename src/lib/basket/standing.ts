import type { BasketUnit } from "@/lib/contracts";
import { BUYER_IDS } from "@/lib/mandate/defaults";

/**
 * One line of a kitchen's standing weekly order. `weeks` holds the amount of the last four weeks, oldest first, then
 * this week's; undefined where the line was not ordered that week.
 */
export interface StandingLine {
  /** The short name drift sentences use: "Cream", "Eggs". */
  label: string;
  words: string;
  unit: BasketUnit;
  weeks: [number | undefined, number | undefined, number | undefined, number | undefined, number];
  /** A product code the kitchen fixed for this line; the search is skipped. */
  productId?: string;
  /** Why this week differs, said in the draft. */
  note?: string;
  /** Played in the older seeded weeks too, so drift has four weeks of data; the other lines only last week. */
  trend?: true;
}

/** Index of last week and of this week in `weeks`. */
export const LAST_WEEK = 3;
export const THIS_WEEK = 4;

/** Arla lactose-free fat-free UHT milk drink: 51 units in the recording, and its only signed swap is not UHT. */
const ARLA_UHT_MILK = "462775";
/** Alpro almond drink: contains nuts, which Nordic Harbour's mandate excludes. */
const ALMOND_DRINK = "461360";
/** Dafgårds ciabatta: may contain sesame, which Kaisla excludes even as a trace. */
const CIABATTA = "471464";

const same = (amount: number): StandingLine["weeks"] => [amount, amount, amount, amount, amount];

/**
 * Nordic Harbour Hotels: breakfast buffets and two restaurants, delivered on Monday. Verified on the recorded data:
 * 17 lines confirm alone; butter is over the per-order limit this week; the UHT milk is short and its only signed
 * swap is not UHT; the almond drink contains nuts, and a nut-free plant drink is offered instead.
 */
const NORDIC_HARBOUR: StandingLine[] = [
  { label: "Lactose-free milk", words: "1,000 litres of lactose-free milk", unit: "l", weeks: [900, 950, 1000, 1000, 1000] },
  { trend: true, label: "Cream", words: "lactose-free whipping cream", unit: "l", weeks: [25, 28, 32, 35, 35] },
  { trend: true, label: "Eggs", words: "eggs for the breakfast buffets", unit: "kg", weeks: same(36) },
  { label: "Butter", words: "butter", unit: "kg", weeks: [60, 60, 60, 60, 250], note: "Christmas baking starts this week." },
  { label: "Grated cheese", words: "grated cheese", unit: "kg", weeks: same(20) },
  { label: "Cheddar slices", words: "cheddar cheese slices", unit: "kg", weeks: same(15) },
  { label: "Cream cheese", words: "lactose-free cream cheese", unit: "kg", weeks: same(10) },
  { label: "Yoghurt", words: "natural yoghurt", unit: "kg", weeks: [30, 32, 36, 40, 40] },
  { label: "Quark", words: "lactose-free quark", unit: "kg", weeks: same(20) },
  { label: "Sour cream", words: "lactose-free sour cream", unit: "kg", weeks: same(10) },
  { label: "Flatbread", words: "flatbread", unit: "kg", weeks: same(10) },
  { label: "Ciabatta", words: "ciabatta rolls", unit: "kg", weeks: same(10) },
  { label: "Potatoes", words: "potatoes", unit: "kg", weeks: [140, 130, 120, 120, 120] },
  { label: "Tomatoes", words: "tomatoes", unit: "kg", weeks: same(30) },
  { label: "Carrots", words: "carrots", unit: "kg", weeks: same(40) },
  { label: "Red onions", words: "red onions", unit: "kg", weeks: same(20) },
  { label: "Oat flakes", words: "oat flakes for porridge", unit: "kg", weeks: same(30) },
  { trend: true, label: "Oat drink", words: "oat drink", unit: "l", weeks: [40, 50, 50, 60, 60] },
  { label: "UHT skimmed milk", words: "lactose-free UHT skimmed milk", unit: "l", weeks: [undefined, undefined, undefined, undefined, 200], productId: ARLA_UHT_MILK,
    note: "For the new room-service fridges." },
  { label: "Almond drink", words: "Alpro almond drink", unit: "l", weeks: [undefined, undefined, undefined, undefined, 40], productId: ALMOND_DRINK,
    note: "Asked for by the vegan breakfast guests." },
];

/** Kaisla School Kitchens: school lunches for eleven schools, strict about nuts and sesame. */
const KAISLA: StandingLine[] = [
  { trend: true, label: "Lactose-free milk", words: "lactose-free milk for school lunches", unit: "l", weeks: [780, 800, 820, 850, 850],
    note: "Over the €800 order limit every week, so Antti signs it." },
  { label: "Carrots", words: "carrots", unit: "kg", weeks: same(100) },
  { label: "Potatoes", words: "potatoes", unit: "kg", weeks: [180, 190, 200, 200, 200] },
  { label: "Oat flakes", words: "oat flakes for breakfast porridge", unit: "kg", weeks: same(150) },
  { label: "Macaroni", words: "macaroni", unit: "kg", weeks: same(60) },
  { label: "Minced meat", words: "minced meat", unit: "kg", weeks: same(40) },
  { trend: true, label: "Chicken", words: "chicken thigh", unit: "kg", weeks: [30, 30, 35, 40, 40] },
  { label: "Rapeseed oil", words: "rapeseed oil", unit: "l", weeks: same(20) },
  { label: "Margarine", words: "vegetable margarine", unit: "kg", weeks: same(10) },
  { label: "Grated cheese", words: "grated cheese", unit: "kg", weeks: same(25) },
  { label: "Quark", words: "lactose-free quark", unit: "kg", weeks: same(20) },
  { label: "Yoghurt", words: "natural yoghurt", unit: "kg", weeks: [60, 55, 50, 45, 45] },
  { label: "Eggs", words: "eggs", unit: "kg", weeks: same(12) },
  { label: "Sour cream", words: "lactose-free sour cream", unit: "kg", weeks: same(10) },
  { label: "Tomatoes", words: "tomatoes", unit: "kg", weeks: same(20) },
  { label: "Ciabatta", words: "ciabatta rolls", unit: "kg", weeks: [undefined, undefined, undefined, undefined, 20], productId: CIABATTA,
    note: "For the Friday soup lunch." },
];

/** Ravintola Laine: a 60-seat restaurant; the owner sees every product the first time. */
const LAINE: StandingLine[] = [
  { trend: true, label: "Cooking cream", words: "lactose-free cooking cream", unit: "l", weeks: [15, 20, 20, 20, 20] },
  { label: "Salmon", words: "salmon fillet", unit: "kg", weeks: same(10) },
  { label: "Rapeseed oil", words: "rapeseed oil", unit: "l", weeks: same(10) },
  { label: "Butter", words: "butter", unit: "kg", weeks: same(5) },
  { label: "Eggs", words: "eggs", unit: "kg", weeks: same(5) },
  { label: "Potatoes", words: "potatoes", unit: "kg", weeks: same(40) },
  { label: "Tomatoes", words: "tomatoes", unit: "kg", weeks: same(10) },
  { label: "Onions", words: "red onions", unit: "kg", weeks: same(10) },
  { label: "Cream cheese", words: "lactose-free cream cheese", unit: "kg", weeks: same(3) },
  { label: "Cheddar slices", words: "cheddar cheese slices", unit: "kg", weeks: same(5) },
  { label: "Pasta", words: "fusilli pasta", unit: "kg", weeks: same(10) },
  { label: "Coffee", words: "espresso coffee beans", unit: "kg", weeks: [undefined, undefined, undefined, undefined, 2], note: "A new espresso machine." },
];

const STANDING: Record<string, StandingLine[]> = {
  [BUYER_IDS.nordicHarbour]: NORDIC_HARBOUR,
  [BUYER_IDS.kaisla]: KAISLA,
  [BUYER_IDS.laine]: LAINE,
};

/** A demo buyer's standing weekly order; empty for a buyer without one. */
export function standingOrder(buyerId: string): StandingLine[] {
  return STANDING[buyerId] ?? [];
}
