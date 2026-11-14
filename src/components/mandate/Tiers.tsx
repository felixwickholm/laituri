import type { Tiers as TierList } from "@/lib/console/format/mandate";

const COLUMNS: { key: keyof TierList; title: string; tone: string }[] = [
  { key: "alone", title: "Allowed alone", tone: "tone-success" },
  { key: "ask", title: "Ask a person", tone: "tone-waiting" },
  { key: "never", title: "Never", tone: "tone-danger" },
];

/** The mandate in three plain tiers, recomputed as the person edits. */
export function Tiers({ tiers }: { tiers: TierList }) {
  return (
    <div className="tiers">
      {COLUMNS.map((column) => (
        <div key={column.key}>
          <h3 className={column.tone}>{column.title}</h3>
          <ul>
            {tiers[column.key].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
