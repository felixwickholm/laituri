/** Points and glyphs for the agent orb. Pure, so the shape is the same on every render and testable. */

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const GLYPH_EVERY = 30;
const FALLBACK_GLYPHS = "0123456789";

/**
 * `count` points spread evenly on a unit sphere (Fibonacci lattice), y from +1 at the top to -1 at the bottom.
 * Returned flat as x0, y0, z0, x1, … so the renderer can read them without allocating.
 */
export function fibonacciSphere(count: number): Float32Array {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    points[i * 3] = Math.cos(theta) * ring;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = Math.sin(theta) * ring;
  }
  return points;
}

/** A small seeded generator (mulberry32), so the dust shell looks the same on every visit. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The faint outer shell: random points between `inner` and `outer` radius, seeded. */
export function dustShell(count: number, inner: number, outer: number, seed = 7): Float32Array {
  const random = seededRandom(seed);
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - y * y);
    const radius = inner + (outer - inner) * Math.pow(random(), 2);
    points[i * 3] = Math.cos(theta) * ring * radius;
    points[i * 3 + 1] = y * radius;
    points[i * 3 + 2] = Math.sin(theta) * ring * radius;
  }
  return points;
}

/** True when point `index` is drawn as a glyph instead of a dot. */
export function isGlyph(index: number, every = GLYPH_EVERY): boolean {
  return every > 0 && index % every === every - 1;
}

/** The characters the orb is made of: the digits and hex letters of the deal, in order, or 0-9 when there are none. */
export function glyphAlphabet(digits: string | undefined): string {
  const kept = (digits ?? "").toLowerCase().replace(/[^0-9a-f]/g, "");
  return kept || FALLBACK_GLYPHS;
}

/** The glyph shown at point `index`: the deal's characters read in order around the sphere. */
export function glyphFor(digits: string | undefined, index: number, every = GLYPH_EVERY): string {
  const alphabet = glyphAlphabet(digits);
  const slot = Math.floor(index / every);
  return alphabet[slot % alphabet.length];
}

/** How many dots suit a drawn size: 2,500 for a small orb up to 4,000 for a large one. */
export function dotCountFor(sizePx: number): number {
  const t = Math.min(1, Math.max(0, (sizePx - 160) / (520 - 160)));
  return Math.round(2500 + t * 1500);
}
