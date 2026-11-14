"use client";

import { useEffect, type RefObject } from "react";
import {
  HOLE_PAD,
  HOLE_RADIUS,
  clampToView,
  dimPath,
  easeSheet,
  inflate,
  lerpBox,
  mergeHoles,
  placeCard,
  roundedRect,
  scrollDelta,
  union,
  type Box,
  type CardSide,
} from "@/lib/tour/geometry";
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
/** How far the dimmed layer reaches past the screen, so its softened edge stays off screen. */
const BLEED = 48;

interface Refs {
  dim: RefObject<SVGPathElement | null>;
  ring: RefObject<SVGPathElement | null>;
  card: RefObject<HTMLElement | null>;
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

/** Sets an attribute only when it changed, so a still spotlight does not repaint the softened layer every frame. */
function setPath(element: SVGPathElement | null, d: string): void {
  if (element && element.getAttribute("d") !== d) element.setAttribute("d", d);
}

/**
 * Draws the dimmed page with a rounded cut-out around the first visible match of each selector group (only the
 * first group on a phone), eases the cut-outs to each new target, keeps them on their targets while the page scrolls
 * or grows, scrolls new targets into the open part of the screen, and places a floating card where it covers none
 * of them. `groups` null closes the cut-outs.
 */
export function useSpotlight(groups: readonly (readonly string[])[] | null, { dim, ring, card: cardRef }: Refs, floatCard: boolean): void {
  const key = groups?.map((group) => group.join("|")).join("||") ?? "";

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : MOVE_MS;
    const lists = key ? key.split("||").map((group) => group.split("|")) : [];
    let frame = 0;
    let targets: (Element | null)[] = [];
    let current: Box[] = tourStore.lastHoles;
    let from: Box[] = current;
    let start = performance.now();
    let card: { x: number; y: number } | undefined;
    let cardMotion: { from: { x: number; y: number } | undefined; start: number } = { from: undefined, start: 0 };
    let side: CardSide | undefined;
    let targetSince = 0;
    let scrolledAt = 0;

    const tick = (now: number) => {
      const view = { w: window.innerWidth, h: window.innerHeight };
      const sheet = view.w < SHEET_BELOW;
      // A phone has room above its bottom sheet for one target only: the first group.
      const found = (sheet ? lists.slice(0, 1) : lists).map(firstVisible);
      if (found.length !== targets.length || found.some((element, index) => element !== targets[index])) {
        targets = found;
        targetSince = now;
        from = current;
        start = now;
      }

      const cardEl = cardRef.current;
      const cardSize = cardEl ? { w: cardEl.offsetWidth, h: cardEl.offsetHeight } : { w: 0, h: 0 };
      const boxes = targets.filter((element): element is Element => element !== null).map(boxOf);
      const all = union(boxes);
      const drifted = all !== undefined && now - targetSince < SETTLE_MS && now - scrolledAt > RESCROLL_MS && offScreen(all, view);
      if (all && (targetSince > scrolledAt || drifted)) {
        scrolledAt = now;
        const beside = view.w - (all.x + all.w) >= cardSize.w + 44 || all.x >= cardSize.w + 44;
        const reserve = sheet ? cardSize.h + 16 : beside ? 24 : cardSize.h + 44;
        const delta = scrollDelta(all, view, reserve, sheet ? PHONE_BAR : 24);
        if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior: reduced ? "auto" : "smooth" });
      }

      const held = boxes.map((box) => clampToView(inflate(box, HOLE_PAD), view));
      const wanted = held.length ? held : current.map(point);
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      const eased = easeSheet(t);
      current = wanted.map((box, index) => {
        const origin = from[index] ?? from[0] ?? point(box);
        return lerpBox(origin, box, eased);
      });
      const open = current.filter((box) => box.w > 1 && box.h > 1);
      setPath(dim.current, dimPath(view, open, HOLE_RADIUS, BLEED));
      setPath(ring.current, mergeHoles(open).map((box) => roundedRect(box, HOLE_RADIUS)).join(""));
      tourStore.lastHoles = open;

      if (cardEl && floatCard && !sheet) {
        const place = placeCard(held, cardSize, view);
        if (place.side !== side || !card) {
          cardMotion = { from: card, start: now };
          side = place.side;
        }
        const c = duration ? Math.min(1, (now - cardMotion.start) / duration) : 1;
        const origin = cardMotion.from;
        card = origin ? { x: origin.x + (place.x - origin.x) * easeSheet(c), y: origin.y + (place.y - origin.y) * easeSheet(c) } : { x: place.x, y: place.y };
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
