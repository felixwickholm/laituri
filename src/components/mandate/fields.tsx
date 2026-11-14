"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  );
}

interface ChoiceProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}

/** A small segmented choice that sits inside a rule sentence. */
export function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <span className="segmented inline" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </span>
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
