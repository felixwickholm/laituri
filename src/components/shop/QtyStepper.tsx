"use client";

import { Minus, Plus } from "lucide-react";

interface Props {
  packs: number;
  step: number;
  /** What the packs come to: "12 l". */
  amount: string;
  name: string;
  onChange: (packs: number) => void;
}

/** Packs up and down by the product's order step. The amount in litres or kilos stays beside it. */
export function QtyStepper({ packs, step, amount, name, onChange }: Props) {
  return (
    <div className="qty" role="group" aria-label={`Quantity of ${name}`}>
      <button type="button" className="qty-btn" onClick={() => onChange(packs - step)} aria-label={packs - step <= 0 ? `Remove ${name}` : "One less"}>
        <Minus aria-hidden="true" />
      </button>
      <span className="qty-value" aria-live="polite">
        <strong>{packs}</strong>
        <span>{amount}</span>
      </span>
      <button type="button" className="qty-btn" onClick={() => onChange(packs + step)} aria-label="One more">
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}
