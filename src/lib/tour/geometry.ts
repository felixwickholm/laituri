/** Pure geometry for the spotlight: the cut-out, its movement between targets, and where the card sits. */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Room left around the target so its own border and focus ring stay inside the cut-out. */
export const HOLE_PAD = 8;
export const HOLE_RADIUS = 18;
const GAP = 20;

export function inflate(box: Box, pad: number): Box {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}

/** Keeps the cut-out inside the viewport, so a target taller than the screen still reads as one shape. */
export function clampToView(box: Box, view: Size, edge = 6): Box {
  const x = Math.max(edge, box.x);
  const y = Math.max(edge, box.y);
  const right = Math.min(view.w - edge, box.x + box.w);
  const bottom = Math.min(view.h - edge, box.y + box.h);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

export function lerpBox(from: Box, to: Box, t: number): Box {
  const at = (a: number, b: number) => a + (b - a) * t;
  return { x: at(from.x, to.x), y: at(from.y, to.y), w: at(from.w, to.w), h: at(from.h, to.h) };
}

export function sameBox(a: Box, b: Box, tolerance = 0.5): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance && Math.abs(a.w - b.w) <= tolerance && Math.abs(a.h - b.h) <= tolerance;
}

/** A CSS cubic-bezier timing function, solved for x by Newton steps with a bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bez = (t: number, a: number, b: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  const slope = (t: number, a: number, b: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * (1 - t) * t + 3 * (1 - b) * t ** 2;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = bez(t, x1, x2) - x;
      const d = slope(t, x1, x2);
      if (Math.abs(error) < 1e-6) return bez(t, y1, y2);
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const value = bez(t, x1, x2);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return bez(t, y1, y2);
  };
}

/** The sheet curve the console uses for panels, so the spotlight moves like everything else that slides. */
export const easeSheet = cubicBezier(0.32, 0.72, 0, 1);

/** A rounded rectangle as one SVG subpath. */
export function roundedRect(box: Box, radius: number): string {
  const r = Math.max(0, Math.min(radius, box.w / 2, box.h / 2));
  const { x, y, w, h } = box;
  const f = (n: number) => Math.round(n * 10) / 10;
  return [
    `M${f(x + r)} ${f(y)}`,
    `H${f(x + w - r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}`,
    `V${f(y + h - r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}`,
    `H${f(x + r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}`,
    `V${f(y + r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}`,
    "Z",
  ].join("");
}

/** The dimmed page with the hole cut out, for an SVG path filled with the even-odd rule. */
export function dimPath(view: Size, hole: Box | undefined, radius = HOLE_RADIUS): string {
  const outer = `M0 0H${view.w}V${view.h}H0Z`;
  return hole && hole.w > 0 && hole.h > 0 ? `${outer}${roundedRect(hole, radius)}` : outer;
}

export type CardSide = "below" | "above" | "right" | "left" | "bottom";

/**
 * Where the card goes: below or above the target when it fits there, else beside it, else at the foot of
 * the screen. It never covers the target when any of those fit.
 */
export function placeCard(target: Box | undefined, card: Size, view: Size, edge = 24): { x: number; y: number; side: CardSide } {
  const centreX = (view.w - card.w) / 2;
  const clampX = (x: number) => Math.min(Math.max(edge, x), view.w - card.w - edge);
  const clampY = (y: number) => Math.min(Math.max(edge, y), view.h - card.h - edge);
  const bottom = { x: centreX, y: view.h - card.h - edge * 1.5, side: "bottom" as const };
  if (!target) return bottom;

  const besideY = clampY(target.y + target.h / 2 - card.h / 2);
  if (view.w - (target.x + target.w) >= card.w + GAP + edge) return { x: target.x + target.w + GAP, y: besideY, side: "right" };
  if (target.x >= card.w + GAP + edge) return { x: target.x - GAP - card.w, y: besideY, side: "left" };
  const underX = clampX(target.x + target.w / 2 - card.w / 2);
  if (view.h - (target.y + target.h) >= card.h + GAP + edge) return { x: underX, y: target.y + target.h + GAP, side: "below" };
  if (target.y >= card.h + GAP + edge) return { x: underX, y: target.y - GAP - card.h, side: "above" };
  return bottom;
}

/**
 * How far to scroll so the target sits in the open part of the screen: centred above a bottom sheet on phones,
 * centred on desktop, and its top in view when it is taller than the room.
 */
export function scrollDelta(target: Box, view: Size, reserveBottom: number, reserveTop: number): number {
  const room = view.h - reserveBottom - reserveTop;
  const wanted = target.h <= room ? reserveTop + (room - target.h) / 2 : reserveTop + 8;
  return target.y - wanted;
}
