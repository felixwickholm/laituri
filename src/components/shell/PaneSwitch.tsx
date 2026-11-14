export type PaneId = "agent" | "approvals" | "proof";

const OPTIONS: { id: PaneId; label: string }[] = [
  { id: "agent", label: "Agent" },
  { id: "approvals", label: "Needs you" },
  { id: "proof", label: "Proof" },
];

interface PaneSwitchProps {
  value: PaneId;
  onChange: (pane: PaneId) => void;
  counts: Record<PaneId, number>;
  broken: boolean;
}

/** Below 1100px the three panes share one column; this picks which one shows. */
export function PaneSwitch({ value, onChange, counts, broken }: PaneSwitchProps) {
  return (
    <nav className="pane-switch" aria-label="Panes">
      <div className="segmented" role="tablist">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={value === option.id}
            aria-controls={`pane-${option.id}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
            <span className={`count mono ${option.id === "approvals" && counts.approvals > 0 ? "tone-waiting" : option.id === "proof" && broken ? "tone-danger" : ""}`}>
              {counts[option.id]}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
