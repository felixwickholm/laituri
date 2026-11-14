"use client";

import { CATEGORIES, type Category } from "@/lib/shop-console/format";

/** Product groups as chips. One can be on at a time; pressing it again shows every group. */
export function CategoryChips({ value, onPick }: { value: string | undefined; onPick: (category: Category | undefined) => void }) {
  return (
    <div className="store-chips" role="group" aria-label="Product group">
      {CATEGORIES.map((category) => {
        const on = category.group === value;
        return (
          <button key={category.group} type="button" aria-pressed={on} onClick={() => onPick(on ? undefined : category)}>
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
