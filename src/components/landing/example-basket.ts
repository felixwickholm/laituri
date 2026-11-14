import type { BasketLine, LineState } from "@/lib/contracts";
import type { OrbState } from "@/lib/console/orb-params";

/** The challenge sheet's own example sentence, the striking line of the example basket. */
export const EXAMPLE_REQUEST = "I need 1,000 litres of lactose-free milk by Monday.";

/**
 * The hero's example: six lines of a weekly order and how each one ends, the same three outcomes the live demo gives.
 * It is labelled as an example on the page; the live basket is one press away.
 */
export const EXAMPLE_LINES: readonly BasketLine[] = [
  { id: "ex-milk", words: "lactose-free milk", asked: { amount: 1000, unit: "l" }, state: "green", reasonCode: "ordered", reason: "Ordered. Same as last week." },
  { id: "ex-eggs", words: "eggs", asked: { amount: 36, unit: "kg" }, state: "green", reasonCode: "ordered", reason: "Ordered. You bought this 6 times." },
  { id: "ex-butter", words: "butter", asked: { amount: 12, unit: "kg" }, state: "green", reasonCode: "ordered", reason: "Ordered. Inside your limits." },
  { id: "ex-cream", words: "cooking cream", asked: { amount: 40, unit: "l" }, state: "orange", reasonCode: "substitute_needs_ok", reason: "Another brand. It needs your OK." },
  { id: "ex-pesto", words: "green pesto", asked: { amount: 6, unit: "kg" }, state: "red", reasonCode: "allergen", reason: "Contains nuts. Your rules say no." },
  { id: "ex-potato", words: "potatoes", asked: { amount: 80, unit: "kg" }, state: "green", reasonCode: "ordered", reason: "Ordered. Same as last week." },
];

/** When the first line finishes, the gap between lines, and the whole loop. */
export const FIRST_MS = 900;
export const STEP_MS = 650;
export const LOOP_MS = 9000;

export interface ExampleFrame {
  lines: BasketLine[];
  counts: Record<LineState, number>;
  /** The agent's orb follows the basket: at work, then waiting for a person once a line needs one. */
  orb: OrbState;
}

/** The example basket at `elapsed` ms into its loop: lines finish one by one, then the result holds. */
export function exampleFrame(elapsed: number, lines: readonly BasketLine[] = EXAMPLE_LINES): ExampleFrame {
  const t = ((elapsed % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const finished = t < FIRST_MS ? 0 : Math.min(lines.length, 1 + Math.floor((t - FIRST_MS) / STEP_MS));
  const shown = lines.map((line, index) => (index < finished ? line : { ...line, state: "working" as const }));
  const counts: Record<LineState, number> = { green: 0, orange: 0, red: 0, working: 0 };
  for (const line of shown) counts[line.state] += 1;
  const orb: OrbState = counts.working > 0 ? (finished === 0 ? "thinking" : "acting") : counts.orange > 0 ? "approval" : "signed";
  return { lines: shown, counts, orb };
}

/** The finished example, for reduced motion and the first paint. */
export function finalFrame(): ExampleFrame {
  return exampleFrame(LOOP_MS - 1);
}
