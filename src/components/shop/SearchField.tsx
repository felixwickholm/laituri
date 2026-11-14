"use client";

import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
}

/** The shop's one search field, in large type. Results follow as the person types. */
export function SearchField({ value, onChange, busy }: Props) {
  return (
    <div className="store-search" data-tour="shop-search" data-busy={busy ? "" : undefined}>
      <label htmlFor="store-q" className="sr-only">
        Search products
      </label>
      <input
        id="store-q"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name, for example lactose-free milk"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {value ? (
        <button type="button" className="icon-btn" onClick={() => onChange("")} aria-label="Clear the search">
          <X aria-hidden="true" />
        </button>
      ) : (
        <Search className="store-search-icon" aria-hidden="true" />
      )}
    </div>
  );
}
