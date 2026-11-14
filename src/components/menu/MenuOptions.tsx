"use client";

import { useState, type CSSProperties } from "react";
import type { SwapChoice } from "@/lib/menu-console/format";
import type { MenuOption } from "@/lib/menu-console/types";
import { MenuCard } from "./MenuCard";
import { ShoppingList } from "./ShoppingList";

interface MenuOptionsProps {
  menus: MenuOption[];
  orderingId?: string;
  changesFor: (option: MenuOption) => string | undefined;
  openId?: string;
  onOpen: (id: string | undefined) => void;
  onOrder: (option: MenuOption, choices: Record<string, SwapChoice>) => void;
}

/**
 * Three menus side by side, stacked on a phone. The open card's list spans the row below it;
 * on a phone it sits right under its card.
 */
export function MenuOptions({ menus, orderingId, changesFor, openId, onOpen, onOrder }: MenuOptionsProps) {
  const [choices, setChoices] = useState<Record<string, Record<string, SwapChoice>>>({});
  const openIndex = menus.findIndex((menu) => menu.id === openId);
  const open = openIndex === -1 ? undefined : menus[openIndex];
  const featuredIndex = Math.min(1, menus.length - 1);

  return (
    <div className="menu-grid" data-tour="menu-options" style={{ "--open-order": openIndex * 2 + 1 } as CSSProperties}>
      {menus.map((option, index) => (
        <div className="menu-cell" key={option.id} style={{ order: index * 2 }}>
          <MenuCard
            option={option}
            open={option.id === openId}
            featured={index === featuredIndex}
            ordering={orderingId === option.id}
            onToggle={() => onOpen(option.id === openId ? undefined : option.id)}
            onOrder={() => onOrder(option, choices[option.id] ?? {})}
          />
        </div>
      ))}
      {open ? (
        <div className="menu-panel">
          <ShoppingList
            option={open}
            changes={changesFor(open)}
            choices={choices[open.id] ?? {}}
            onChoose={(words, choice) => setChoices((all) => ({ ...all, [open.id]: { ...all[open.id], [words]: choice } }))}
          />
          <button type="button" className="btn btn-primary big" disabled={orderingId === open.id} onClick={() => onOrder(open, choices[open.id] ?? {})}>
            {orderingId === open.id ? "Ordering…" : `Order ${open.name}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
