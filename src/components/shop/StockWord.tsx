import { Check, CircleDashed, Clock, X } from "lucide-react";
import type { Tone } from "@/lib/shop-console/format";

const ICONS = { success: Check, waiting: Clock, danger: X, neutral: CircleDashed } satisfies Record<Tone, typeof Check>;

/** Stock as a word with an icon and its colour, never colour alone. */
export function StockWord({ word, tone }: { word: string; tone: Tone }) {
  const Icon = ICONS[tone];
  return (
    <span className="store-stock" data-tone={tone}>
      <Icon aria-hidden="true" />
      {word}
    </span>
  );
}
