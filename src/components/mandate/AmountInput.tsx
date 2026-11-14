"use client";

import { useState } from "react";
import { count } from "@/lib/console/format/money";
import { parseAmount } from "@/lib/console/format/mandate-patch";

interface AmountInputProps {
  id: string;
  /** The field's name for assistive tech; the sentence around it is the visible label. */
  label: string;
  value: number;
  onChange: (value: number) => void;
}

/** A euro limit inside a rule sentence: grouped ("1,500") when resting, plain digits while the person types. */
export function AmountInput({ id, label, value, onChange }: AmountInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? count(value);
  return (
    <span className="value-chip money">
      <span aria-hidden="true">€</span>
      <input
        id={id}
        aria-label={label}
        className="num"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        size={Math.max(3, shown.length)}
        value={shown}
        onFocus={() => setDraft(String(value))}
        onChange={(event) => {
          setDraft(event.target.value);
          // "1,500" is a grouped thousand, not a decimal comma.
          const parsed = parseAmount(event.target.value.replace(/,(?=\d{3}(\D|$))/g, ""));
          if (parsed !== undefined) onChange(parsed);
        }}
        onBlur={() => setDraft(null)}
      />
    </span>
  );
}
