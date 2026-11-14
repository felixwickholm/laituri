"use client";

import { Ban, Check } from "lucide-react";

interface PickChipsProps {
  label: string;
  options: { id: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
  /** never: on means the agent never buys it. require: on means every product must carry it. */
  tone: "never" | "require";
}

/** Every option visible at once, each a switch: tap to turn it on or off. The icon and the colour both show "on". */
export function PickChips({ label, options, values, onChange, tone }: PickChipsProps) {
  // A value the mandate holds that the list does not show (an older rule) stays visible, so it can be turned off.
  const extra = values.filter((id) => !options.some((option) => option.id === id)).map((id) => ({ id, label: id.replace(/_/g, " ") }));
  return (
    <div className="pick-chips" role="group" aria-label={label}>
      {[...options, ...extra].map((option) => {
        const on = values.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className="pick-chip"
            data-tone={tone}
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((value) => value !== option.id) : [...values, option.id])}
          >
            {on ? tone === "never" ? <Ban aria-hidden="true" /> : <Check aria-hidden="true" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
