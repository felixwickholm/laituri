import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface TechRow {
  label: string;
  value: ReactNode;
  /** Ids, hashes, tool names and model ids are set in the mono face; sentences are not. */
  mono?: boolean;
}

/**
 * Where tool names, ids, model ids and hashes live on a business screen: closed by default, one line to open.
 * Rows with no value are left out, and nothing renders when no row is left.
 */
export function TechDetails({ rows, label = "Technical details" }: { rows: readonly TechRow[]; label?: string }) {
  const shown = rows.filter((row) => row.value !== undefined && row.value !== null && row.value !== "");
  if (shown.length === 0) return null;
  return (
    <details className="tech-details">
      <summary>
        <ChevronRight aria-hidden="true" />
        {label}
      </summary>
      <dl>
        {shown.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.mono ? "mono" : undefined}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
