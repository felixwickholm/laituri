import { describe, expect, it } from "vitest";
import { clampToView, cubicBezier, dimPath, easeSheet, lerpBox, mergeHoles, placeCard, scrollDelta, union } from "@/lib/tour/geometry";

const VIEW = { w: 1440, h: 900 };
const CARD = { w: 520, h: 240 };

describe("spotlight geometry", () => {
  it("eases from 0 to 1 along the curve, monotonically", () => {
    expect(easeSheet(0)).toBe(0);
    expect(easeSheet(1)).toBe(1);
    let last = 0;
    for (let t = 0.05; t < 1; t += 0.05) {
      const value = easeSheet(t);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
    expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 4);
  });

  it("moves a box part of the way and keeps the cut-out on screen", () => {
    expect(lerpBox({ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 50, w: 30, h: 10 }, 0.5)).toEqual({ x: 50, y: 25, w: 20, h: 10 });
    expect(clampToView({ x: -20, y: 100, w: 200, h: 2000 }, VIEW)).toEqual({ x: 6, y: 100, w: 174, h: 794 });
  });

  it("cuts a hole only when there is one, and lets the dim bleed past the screen", () => {
    expect(dimPath(VIEW, [])).toBe("M0 0H1440V900H0Z");
    expect(dimPath(VIEW, [{ x: 10, y: 10, w: 100, h: 50 }])).toMatch(/^M0 0H1440V900H0ZM/);
    expect(dimPath(VIEW, [], 18, 40)).toBe("M-40 -40H1480V940H-40Z");
  });

  it("cuts two holes apart, and merges holes that overlap so their overlap stays clear", () => {
    const run = { x: 300, y: 100, w: 600, h: 300 };
    const panel = { x: 980, y: 100, w: 400, h: 500 };
    expect(mergeHoles([run, panel])).toEqual([run, panel]);
    expect(dimPath(VIEW, [run, panel]).match(/Z/g)).toHaveLength(3);
    const touching = { x: 850, y: 300, w: 200, h: 100 };
    expect(mergeHoles([run, touching])).toEqual([union([run, touching])]);
    expect(mergeHoles([{ x: 0, y: 0, w: 0, h: 0 }])).toEqual([]);
  });

  it("puts the card beside a target with room, else below or above, never over it", () => {
    const right = placeCard([{ x: 300, y: 300, w: 300, h: 100 }], CARD, VIEW);
    expect(right.side).toBe("right");
    const left = placeCard([{ x: 1000, y: 300, w: 400, h: 100 }], CARD, VIEW);
    expect(left).toMatchObject({ side: "left", x: 1000 - 20 - 520 });
    const below = placeCard([{ x: 280, y: 100, w: 900, h: 300 }], CARD, VIEW);
    expect(below.side).toBe("below");
    expect(below.y).toBeGreaterThanOrEqual(400);
    const above = placeCard([{ x: 280, y: 500, w: 900, h: 300 }], CARD, VIEW);
    expect(above.side).toBe("above");
    expect(above.y + CARD.h).toBeLessThanOrEqual(500);
    expect(placeCard([], CARD, VIEW).side).toBe("bottom");
  });

  it("with two targets, puts the card where it covers neither", () => {
    const run = { x: 290, y: 24, w: 670, h: 380 };
    const panel = { x: 980, y: 24, w: 400, h: 560 };
    const place = placeCard([run, panel], CARD, VIEW);
    expect(place.side).toBe("below");
    expect(place.y).toBeGreaterThanOrEqual(run.y + run.h);
    expect(place.x + CARD.w).toBeLessThanOrEqual(panel.x);
  });

  it("scrolls a target into the open part of the screen", () => {
    expect(scrollDelta({ x: 0, y: 1200, w: 100, h: 100 }, VIEW, 300, 24)).toBe(1200 - (24 + (900 - 300 - 24 - 100) / 2));
    expect(scrollDelta({ x: 0, y: 1200, w: 100, h: 2000 }, VIEW, 300, 24)).toBe(1200 - 32);
  });
});
