"use client";

import { AlertTriangle, Check, ChevronDown, X } from "lucide-react";
import { COURSE_WORD, money, servedOrder, TIER_WORD, wholeMoney } from "@/lib/menu-console/format";
import type { MenuOption } from "@/lib/menu-console/types";
import { CourseIcon } from "./CourseIcon";

interface MenuCardProps {
  option: MenuOption;
  open: boolean;
  ordering: boolean;
  /** The middle card carries the tour hook on its order button. */
  featured: boolean;
  onToggle: () => void;
  onOrder: () => void;
}

/** One menu as a printed menu card: tier, name, courses, price per guest, what it fits, one action. */
export function MenuCard({ option, open, ordering, featured, onToggle, onOrder }: MenuCardProps) {
  const listId = `menu-list-${option.id}`;
  return (
    <article className="menu-card" data-tier={option.tier} data-open={open} aria-labelledby={`menu-name-${option.id}`}>
      <header className="menu-card-head">
        <span className="menu-tier">{TIER_WORD[option.tier]}</span>
        <h3 className="menu-name" id={`menu-name-${option.id}`}>
          {option.name}
        </h3>
        {option.tagline ? <p className="menu-tagline">{option.tagline}</p> : null}
      </header>

      <ol className="menu-courses">
        {servedOrder(option.courses).map(({ course, recipe }) => (
          <li key={`${course}-${recipe.id}`}>
            <CourseIcon course={course} />
            <span className="menu-course-word">{COURSE_WORD[course]}</span>
            <span className="menu-dish">{recipe.name}</span>
          </li>
        ))}
      </ol>

      <div className="menu-price">
        <span className="menu-per-guest">{money(option.costPerGuest)}</span>
        <span className="menu-per-guest-label">per guest</span>
        <span className="menu-total">{wholeMoney(option.totalNet)} in total</span>
        <span className="menu-total">{wholeMoney(option.toOrderNet)} to order, in whole packs</span>
        {option.costNote ? <span className="menu-total">{option.costNote}</span> : null}
      </div>

      {option.fits.length ? (
        <ul className="menu-fits">
          {option.fits.map((fit) => (
            <li key={fit.sentence} data-ok={fit.ok}>
              {fit.ok ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
              <span>
                <span className="sr-only">{fit.ok ? "Yes: " : "No: "}</span>
                {fit.sentence}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {option.warnings.length ? <Warnings warnings={option.warnings} /> : null}

      <div className="menu-actions">
        <button type="button" className={`btn ${featured ? "btn-primary" : "btn-secondary"} big wide`} onClick={onOrder} disabled={ordering} data-tour={featured ? "menu-order" : undefined}>
          {ordering ? "Ordering…" : "Order this menu"}
        </button>
        <button type="button" className="menu-see" aria-expanded={open} aria-controls={listId} onClick={onToggle}>
          {open ? "Hide the list" : "See what goes in it"}
          <ChevronDown size={18} aria-hidden />
        </button>
      </div>
    </article>
  );
}

const SHOWN_WARNINGS = 2;

/** The first two warnings in plain sight; the rest one tap away, so the card stays calm. */
function Warnings({ warnings }: { warnings: string[] }) {
  const rest = warnings.slice(SHOWN_WARNINGS);
  const item = (warning: string) => (
    <li key={warning}>
      <AlertTriangle size={16} aria-hidden />
      <span>{warning}</span>
    </li>
  );
  return (
    <div className="menu-warnings">
      <ul>{warnings.slice(0, SHOWN_WARNINGS).map(item)}</ul>
      {rest.length ? (
        <details>
          <summary>
            {rest.length} more {rest.length === 1 ? "warning" : "warnings"}
          </summary>
          <ul>{rest.map(item)}</ul>
        </details>
      ) : null}
    </div>
  );
}
