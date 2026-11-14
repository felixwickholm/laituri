import { Ban, CircleAlert, CircleCheck, LoaderCircle, type LucideIcon } from "lucide-react";
import { LINE_STATE } from "@/lib/console/basket";
import type { LineState } from "@/lib/contracts";

export const STATE_ICON: Record<LineState, LucideIcon> = {
  green: CircleCheck,
  orange: CircleAlert,
  red: Ban,
  working: LoaderCircle,
};

/** A line's state as colour, icon shape and word together; `bare` drops the word where a heading already says it. */
export function StateMark({ state, bare = false }: { state: LineState; bare?: boolean }) {
  const Icon = STATE_ICON[state];
  const { word } = LINE_STATE[state];
  return (
    <span className="state-mark" data-state={state}>
      <Icon key={state} className="state-mark-icon" aria-hidden="true" />
      <span className={bare ? "sr-only" : "state-mark-word"}>{word}</span>
    </span>
  );
}
