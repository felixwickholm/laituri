"use client";

import { AlertTriangle, Check, Repeat, X } from "lucide-react";
import { amountText, AVAILABILITY_WORD, capitalise, groupLines, isLeaveOut, money, usesSwap, type SwapChoice } from "@/lib/menu-console/format";
import { useCourseIndex } from "@/lib/menu-console/hooks";
import type { MenuOption, ShoppingLine } from "@/lib/menu-console/types";

const AVAILABILITY_TONE = { ok: "success", short: "waiting", missing: "danger" } as const;
const AVAILABILITY_ICON = { ok: Check, short: AlertTriangle, missing: X } as const;

interface ShoppingListProps {
  option: MenuOption;
  choices: Record<string, SwapChoice>;
  onChoose: (words: string, choice: SwapChoice) => void;
  /** "72 guests instead of 80: 9 lines get smaller." */
  changes?: string;
}

/** What the menu needs, what the kitchen has, and what to order, grouped by course. */
export function ShoppingList({ option, choices, onChoose, changes }: ShoppingListProps) {
  const courses = useCourseIndex(option);
  const toOrder = option.shoppingList.filter((line) => line.toOrder.amount > 0).length;
  return (
    <section className="shop" id={`menu-list-${option.id}`} aria-label={`What goes in ${option.name}`}>
      <header className="shop-head">
        <h3 className="shop-title">
          {toOrder} {toOrder === 1 ? "line" : "lines"} to order
        </h3>
        <p className="shop-note">Estimated prices</p>
        {changes ? (
          <p className="shop-changes" role="status">
            {changes}
          </p>
        ) : null}
      </header>
      {groupLines(option.shoppingList, courses).map((group) => (
        <div className="shop-group" key={group.label}>
          <h4 className="shop-group-label">{group.label}</h4>
          <ul className="shop-lines">
            {group.lines.map((line, index) => (
              <ShoppingRow key={`${line.words}-${index}`} line={line} choice={choices[line.words]} onChoose={(choice) => onChoose(line.words, choice)} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ShoppingRow({ line, choice, onChoose }: { line: ShoppingLine; choice?: SwapChoice; onChoose: (choice: SwapChoice) => void }) {
  const tone = AVAILABILITY_TONE[line.availability];
  const Icon = AVAILABILITY_ICON[line.availability];
  const nothing = line.toOrder.amount <= 0;
  const swapped = usesSwap(line, choice);
  return (
    <li className="shop-line" data-nothing={nothing}>
      <div className="shop-main">
        <span className="shop-what">{capitalise(swapped && line.swap && !isLeaveOut(line.swap.words) ? line.swap.words : line.words)}</span>
        {line.inPantry && line.inPantry.amount > 0 ? (
          <>
            <span className="shop-need">The menu needs {amountText(line.quantity)}</span>
            <span className="shop-have">From your stock (demo): {amountText(line.inPantry)}</span>
          </>
        ) : null}
      </div>
      <div className="shop-order">
        <span className="shop-amount">{nothing ? "Covered by your stock" : `Order ${amountText(line.toOrder)}`}</span>
        {!nothing && line.estNet !== undefined ? <span className="shop-net">about {money(line.estNet)}</span> : null}
      </div>
      <div className="shop-meta">
        {line.product && (swapped || !line.swap) ? <span className="shop-product" title={line.product.name}>{line.product.displayName}</span> : null}
        {nothing ? null : (
          <span className="shop-state" data-tone={tone}>
            <Icon size={14} aria-hidden />
            {AVAILABILITY_WORD[line.availability]}
          </span>
        )}
      </div>
      {line.swap ? (
        <div className="shop-swap">
          <Repeat size={16} aria-hidden />
          <p>{line.swap.reason}</p>
          {nothing || isLeaveOut(line.swap.words) ? null : (
            <div className="shop-swap-choice" role="group" aria-label={`Swap ${line.words}`}>
              <button type="button" aria-pressed={swapped} onClick={() => onChoose("accepted")}>
                Use {line.swap.words.toLowerCase()}
              </button>
              <button type="button" aria-pressed={!swapped} onClick={() => onChoose("refused")}>
                Keep {line.words.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
