"use client";

import { Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Group({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="group">
      <h3>{label}</h3>
      <div className="group-box">{children}</div>
      {note ? <p className="group-note">{note}</p> : null}
    </section>
  );
}

export function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="set-row">
      <div className="set-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        {hint ? <span className="hint">{hint}</span> : null}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  );
}

interface ChipSetProps {
  values: string[];
  options: Record<string, string>;
  labelOf: (id: string) => string;
  onChange: (next: string[]) => void;
  addLabel: string;
}

/** Removable chips plus an "Add" chip that reveals the remaining options from a fixed list. */
export function ChipSet({ values, options, labelOf, onChange, addLabel }: ChipSetProps) {
  const [adding, setAdding] = useState(false);
  const remaining = Object.keys(options).filter((id) => !values.includes(id));
  return (
    <div className="chipset">
      {values.map((id) => (
        <span key={id} className="chip">
          {labelOf(id)}
          <button type="button" aria-label={`Remove ${labelOf(id)}`} onClick={() => onChange(values.filter((value) => value !== id))}>
            <X width={12} height={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      {remaining.length > 0 ? (
        <button type="button" className="chip chip-add" aria-expanded={adding} onClick={() => setAdding(!adding)}>
          <Plus width={12} height={12} aria-hidden="true" />
          {adding ? "Done" : addLabel}
        </button>
      ) : null}
      {adding ? (
        <div className="chip-options">
          {remaining.map((id) => (
            <button key={id} type="button" className="chip chip-add" onClick={() => onChange([...values, id])}>
              {labelOf(id)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
