import { describe, expect, it } from "vitest";
import { dotCountFor, dustShell, fibonacciSphere, glyphAlphabet, glyphFor, isGlyph, seededRandom } from "@/lib/console/orb-geometry";

describe("fibonacciSphere", () => {
  it("puts every point on the unit sphere, from the top to the bottom", () => {
    const points = fibonacciSphere(500);
    expect(points).toHaveLength(1500);
    for (let i = 0; i < 500; i++) {
      const [x, y, z] = [points[i * 3], points[i * 3 + 1], points[i * 3 + 2]];
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
    }
    expect(points[1]).toBeCloseTo(1);
    expect(points[499 * 3 + 1]).toBeCloseTo(-1);
  });

  it("spreads points evenly: each half holds half of them", () => {
    const points = fibonacciSphere(1000);
    let upper = 0;
    for (let i = 0; i < 1000; i++) if (points[i * 3 + 1] > 0) upper++;
    expect(upper).toBe(500);
  });
});

describe("dustShell", () => {
  it("stays between its radii and is the same on every call", () => {
    const shell = dustShell(200, 1.1, 1.3, 3);
    for (let i = 0; i < 200; i++) {
      const r = Math.hypot(shell[i * 3], shell[i * 3 + 1], shell[i * 3 + 2]);
      expect(r).toBeGreaterThanOrEqual(1.1 - 1e-6);
      expect(r).toBeLessThanOrEqual(1.3 + 1e-6);
    }
    expect(Array.from(dustShell(200, 1.1, 1.3, 3))).toEqual(Array.from(shell));
  });

  it("uses a seeded generator in 0..1", () => {
    const a = seededRandom(9);
    const b = seededRandom(9);
    for (let i = 0; i < 50; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("glyphs", () => {
  it("makes every 30th point a glyph", () => {
    expect(isGlyph(29)).toBe(true);
    expect(isGlyph(30)).toBe(false);
    expect(Array.from({ length: 120 }, (_, i) => i).filter((i) => isGlyph(i))).toEqual([29, 59, 89, 119]);
  });

  it("reads the deal's digits in order around the sphere", () => {
    expect(glyphFor("161600", 29)).toBe("1");
    expect(glyphFor("161600", 59)).toBe("6");
    expect(glyphFor("161600", 29 + 30 * 6)).toBe("1");
  });

  it("keeps hex characters of a hash and falls back to 0-9", () => {
    expect(glyphAlphabet("sha256:7C41-e2")).toBe("a2567c41e2");
    expect(glyphAlphabet("")).toBe("0123456789");
    expect(glyphAlphabet(undefined)).toBe("0123456789");
  });
});

describe("dotCountFor", () => {
  it("uses 2,500 dots for a small orb and 4,000 for a large one", () => {
    expect(dotCountFor(120)).toBe(2500);
    expect(dotCountFor(160)).toBe(2500);
    expect(dotCountFor(520)).toBe(4000);
    expect(dotCountFor(900)).toBe(4000);
    expect(dotCountFor(340)).toBe(3250);
  });
});
