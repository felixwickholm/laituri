"use client";

import { useState } from "react";
import { count } from "@/lib/console/format/money";
import { parseAmount } from "@/lib/console/format/mandate-patch";

interface AmountInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
}

/** A euro limit: grouped ("1,500") when resting, plain digits while the person types. */
export function AmountInput({ id, value, onChange }: AmountInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="money-field">
      <span aria-hidden="true">€</span>
      <input
        id={id}
        className="text-field num"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft ?? count(value)}
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
