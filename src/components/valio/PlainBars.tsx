import { count } from "@/lib/console/format/money";
import type { PlainBar } from "@/lib/supplier-console/types";

/**
 * One plain horizontal bar per row: a short label, the bar, and its number. The longest bar fills the lane; the tone
 * colours only the bar, so the chart reads without a legend.
 */
export function PlainBars({ rows, label }: { rows: PlainBar[]; label: string }) {
  const top = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="plain-bars-frame">
      <ol className="plain-bars" aria-label={label}>
        {rows.map((row) => (
          <li key={row.key} className="plain-bar" data-tone={row.tone}>
            <span className="plain-bar-label">
              {row.label}
              {row.note ? <span className="sub">{row.note}</span> : null}
            </span>
            <span className="plain-bar-lane" aria-hidden="true">
              <span className="plain-bar-fill" style={{ width: `${(row.count / top) * 100}%` }} />
            </span>
            <span className="plain-bar-count num">{count(row.count)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
