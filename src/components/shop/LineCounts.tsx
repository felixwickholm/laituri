import type { LineState } from "@/lib/contracts";
import { StateMark } from "../basket/StateMark";

const ORDER: LineState[] = ["green", "orange", "red", "working"];

/** How many lines are in each state, each as a mark with its word. States with no lines are left out. */
export function LineCounts({ counts }: { counts: Record<LineState, number> }) {
  const shown = ORDER.filter((state) => counts[state] > 0);
  if (!shown.length) return null;
  return (
    <ul className="store-counts">
      {shown.map((state) => (
        <li key={state}>
          <strong>{counts[state]}</strong>
          <StateMark state={state} />
        </li>
      ))}
    </ul>
  );
}
