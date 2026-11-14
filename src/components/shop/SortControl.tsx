"use client";

import type { SearchPreference } from "@/lib/contracts";
import { PREFERENCES } from "@/lib/shop-console/format";

/** Which matching products come first. The API ranks them; the order is its, not this page's. */
export function SortControl({ value, onChange }: { value: SearchPreference; onChange: (value: SearchPreference) => void }) {
  return (
    <div className="store-sort">
      <span className="store-sort-label" id="store-sort-label">
        Sort by
      </span>
      <div className="segmented inline" role="group" aria-labelledby="store-sort-label">
        {PREFERENCES.map((option) => (
          <button key={option.id} type="button" aria-pressed={option.id === value} onClick={() => onChange(option.id)} title={option.sentence}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
