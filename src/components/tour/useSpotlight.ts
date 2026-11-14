"use client";

import { useEffect, type RefObject } from "react";
import { HOLE_PAD, clampToView, dimPath, easeSheet, inflate, lerpBox, placeCard, roundedRect, scrollDelta, type Box, type CardSide } from "@/lib/tour/geometry";
import { tourStore } from "./tour-store";

/** The spotlight's travel between targets, matching the console's sheets. */
const MOVE_MS = 320;
/** Below this width the card is a bottom sheet and the target is kept above it. */
export const SHEET_BELOW = 720;
const PHONE_BAR = 64;
/** While a new target's page is still loading above it, keep bringing it back into view. */
const SETTLE_MS = 4000;
/** A smooth scroll has finished by then. */
const RESCROLL_MS = 900;

interface Refs {
  dim: RefObject<SVGPathElement | null>;
  ring: RefObject<SVGPathElement | null>;
  card: RefObject<HTMLElement | null>;
}

interface Motion {
  from: Box | undefined;
  start: number;
}

function firstVisible(selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return element;
    }
  }
  return null;
}

/** Less than half of the target is on screen, so the page moved under it after it was scrolled to. */
function offScreen(box: Box, view: { w: number; h: number }): boolean {
  const shown = Math.min(view.h, box.y + box.h) - Math.max(0, box.y);
  return shown < Math.min(box.h, view.h) / 2;
}

function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}

/** A hole shrunk to nothing at the middle of `box`: where the cut-out opens from and closes to. */
function point(box: Box): Box {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2, w: 0, h: 0 };
}

/**
 * Draws the dimmed page with a rounded cut-out around the first visible match of `selectors`, eases it to each
 * new target, keeps it on the target while the page scrolls or grows, scrolls a new target into the open part
 * of the screen, and places a floating card beside, below or above it. `selectors` null closes the cut-out.
 */
export function useSpotlight(selectors: readonly string[] | null, { dim, ring, card: cardRef }: Refs, floatCard: boolean): void {
  const key = selectors?.join("|") ?? "";

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : MOVE_MS;
    const list = key ? key.split("|") : [];
    let frame = 0;
    let target: Element | null = null;
    let current: Box | undefined = tourStore.lastHole;
    let hole: Motion = { from: current, start: performance.now() };
    let card: { x: number; y: number } | undefined;
    let cardMotion: { from: { x: number; y: number } | undefined; start: number } = { from: undefined, start: 0 };
    let side: CardSide | undefined;
    let scrolled: Element | null = null;
    let targetSince = 0;
    let scrolledAt = 0;

    const tick = (now: number) => {
      const view = { w: window.innerWidth, h: window.innerHeight };
      const sheet = view.w < SHEET_BELOW;
      const found = list.length ? firstVisible(list) : null;
      if (found !== target) {
        target = found;
        targetSince = now;
        hole = { from: current ?? (found ? point(boxOf(found)) : undefined), start: now };
      }

      const cardEl = cardRef.current;
      const cardSize = cardEl ? { w: cardEl.offsetWidth, h: cardEl.offsetHeight } : { w: 0, h: 0 };
      const box = target ? boxOf(target) : undefined;
      const drifted = box !== undefined && now - targetSince < SETTLE_MS && now - scrolledAt > RESCROLL_MS && offScreen(box, view);
      if (target && box && (scrolled !== target || drifted)) {
        scrolled = target;
        scrolledAt = now;
        const beside = view.w - (box.x + box.w) >= cardSize.w + 44 || box.x >= cardSize.w + 44;
        const reserve = sheet ? cardSize.h + 16 : beside ? 24 : cardSize.h + 44;
        const delta = scrollDelta(box, view, reserve, sheet ? PHONE_BAR : 24);
        if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior: reduced ? "auto" : "smooth" });
      }

      const held = box ? clampToView(inflate(box, HOLE_PAD), view) : undefined;
      const wanted = held ?? (current ? point(current) : undefined);
      const t = duration ? Math.min(1, (now - hole.start) / duration) : 1;
      current = wanted && hole.from ? lerpBox(hole.from, wanted, easeSheet(t)) : wanted;
      const open = current && current.w > 1 && current.h > 1 ? current : undefined;
      dim.current?.setAttribute("d", dimPath(view, open));
      ring.current?.setAttribute("d", open ? roundedRect(open, 18) : "");
      tourStore.lastHole = open;

      if (cardEl && floatCard && !sheet) {
        const place = placeCard(held, cardSize, view);
        if (place.side !== side || !card) {
          cardMotion = { from: card, start: now };
          side = place.side;
        }
        const c = duration ? Math.min(1, (now - cardMotion.start) / duration) : 1;
        const from = cardMotion.from;
        card = from ? { x: from.x + (place.x - from.x) * easeSheet(c), y: from.y + (place.y - from.y) * easeSheet(c) } : { x: place.x, y: place.y };
        cardEl.style.transform = `translate3d(${Math.round(card.x)}px, ${Math.round(card.y)}px, 0)`;
      } else if (cardEl) {
        cardEl.style.removeProperty("transform");
        card = undefined;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, dim, ring, cardRef, floatCard]);
}
