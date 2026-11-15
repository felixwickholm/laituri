"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Words after the number: "guests", "portions". */
  unit: string;
  /** Told whether the typed number is out of range, so the form can hold its submit and say why. */
  onValidity?: (valid: boolean) => void;
}

/** A number a person changes with two big buttons, or by typing. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 1,
  max = 2000,
  unit,
  onValidity,
}: StepperProps) {
  const set = (next: number) =>
    onChange(Math.min(max, Math.max(min, Math.round(next))));
  /** What the person typed, kept as typed while it is out of range, so 0 never quietly becomes another number. */
  const [typed, setTyped] = useState<string | null>(null);
  const typedNumber = typed === null ? value : Number(typed);
  const invalid =
    typed !== null &&
    typed !== "" &&
    !(Number.isFinite(typedNumber) && typedNumber >= min && typedNumber <= max);
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => {
          setTyped(null);
          onValidity?.(true);
          set(value - step);
        }}
        disabled={value <= min}
        aria-label={`${step} fewer ${unit}`}
      >
        <Minus size={18} aria-hidden />
      </button>
      <label className="stepper-value">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={typed ?? value}
          aria-label={label}
          aria-invalid={invalid || undefined}
          title={`${min} to ${max}`}
          onChange={(event) => {
            setTyped(event.target.value);
            const next = Number(event.target.value);
            const valid =
              event.target.value !== "" &&
              Number.isFinite(next) &&
              Number.isInteger(next) &&
              next >= min &&
              next <= max;
            if (valid) set(next);
            onValidity?.(valid);
          }}
          onBlur={() => {
            // A wrong number stays on screen, marked, until it is fixed; only a valid one is tidied.
            if (!invalid) setTyped(null);
          }}
        />
        <span>{unit}</span>
      </label>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => {
          setTyped(null);
          onValidity?.(true);
          set(value + step);
        }}
        disabled={value >= max}
        aria-label={`${step} more ${unit}`}
      >
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}
