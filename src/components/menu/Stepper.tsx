"use client";

import { Minus, Plus } from "lucide-react";

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Words after the number: "guests", "portions". */
  unit: string;
}

/** A number a person changes with two big buttons, or by typing. */
export function Stepper({ label, value, onChange, step = 1, min = 1, max = 5000, unit }: StepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next))));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper-btn" onClick={() => set(value - step)} disabled={value <= min} aria-label={`${step} fewer ${unit}`}>
        <Minus size={18} aria-hidden />
      </button>
      <label className="stepper-value">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          aria-label={label}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next > 0) set(next);
          }}
        />
        <span>{unit}</span>
      </label>
      <button type="button" className="stepper-btn" onClick={() => set(value + step)} disabled={value >= max} aria-label={`${step} more ${unit}`}>
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}
