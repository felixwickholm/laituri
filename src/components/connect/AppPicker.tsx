"use client";

import { useRef, type KeyboardEvent } from "react";
import { TILES, type TileId } from "@/lib/connect/apps";
import { APP_LOGOS } from "./logos/AppLogos";

/** A row of agent apps. Arrow keys move between them, as in any tab list. */
export function AppPicker({ value, onChange }: { value: TileId; onChange: (id: TileId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + TILES.length) % TILES.length;
    onChange(TILES[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className="cx-apps" role="tablist" aria-label="Agent app">
      {TILES.map((tile, index) => {
        const Logo = APP_LOGOS[tile.id];
        const selected = tile.id === value;
        return (
          <button
            key={tile.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`cx-tab-${tile.id}`}
            aria-selected={selected}
            aria-controls="cx-guide"
            tabIndex={selected ? 0 : -1}
            className="cx-app"
            onClick={() => onChange(tile.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="cx-logo" data-app={tile.id}>
              <Logo />
            </span>
            <span>{tile.name}</span>
          </button>
        );
      })}
    </div>
  );
}
