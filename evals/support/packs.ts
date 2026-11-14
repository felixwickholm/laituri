import type { Quantity } from "@/lib/contracts";

/**
 * What one sales unit of each product the scenarios order holds, written out here from the pack sizes printed on
 * the products, not read from the application catalogue. The scenario suite measures every order with these, so a
 * pack-size error in the application cannot grade itself correct.
 */
export const PACK_CONTENT: Record<string, Quantity & { unit: "l" | "kg" }> = {
  /** Valio Arki Eila semi-skimmed lactose-free milk drink, 1 l carton. */
  "464306": { amount: 1, unit: "l" },
  /** Valio Arki Eila skimmed lactose-free milk drink, 1 l carton. */
  "464401": { amount: 1, unit: "l" },
  /** Arla lactose-free fat-free UHT milk drink, 1 l. */
  "462775": { amount: 1, unit: "l" },
  /** Valio unsalted butter, 500 g. */
  "464411": { amount: 0.5, unit: "kg" },
  /** Oddlygood oat drink, 1 l. */
  "468465": { amount: 1, unit: "l" },
  /** Alpro almond drink, 1 l. */
  "460443": { amount: 1, unit: "l" },
  /** Salmon fillet, sold by the kilo. */
  "462150": { amount: 1, unit: "kg" },
  /** Valio skimmed milk ESL, 1 l. */
  "469477": { amount: 1, unit: "l" },
  /** Valio Eila semi-skimmed lactose-free milk drink, a case of 5 x 1 l. */
  "465039": { amount: 5, unit: "l" },
};
