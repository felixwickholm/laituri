import { dotCountFor, dustShell, fibonacciSphere, glyphFor, isGlyph } from "@/lib/console/orb-geometry";
import { approachParams, contractionAt, easeFactor, orbParams, spinRate, type OrbParams, type OrbState, type OrbTone } from "@/lib/console/orb-params";
import type { OrbPalette } from "./palette";
import { Spin } from "./spin";

/** Sphere radius and dust shell as shares of the drawn size. */
const RADIUS = 0.39;
const DUST_INNER = 1.08;
const DUST_OUTER = 1.27;
const DUST_COUNT = 900;
const DEPTH_LEVELS = 4;
const EFFECT_LEVELS = 4;
const BAND_PERIOD = 1.6;
const RIPPLE_PERIOD = 1.3;
const BREATH_PERIOD = 4;
const PULSE_PERIOD = 2;
const SWEEP_SECONDS = 0.6;
const SWEEP_HOLD = 1.6;
const MAX_DT = 0.05;

type Tone = Exclude<OrbTone, "none">;
const TONES: Tone[] = ["accent", "warn", "danger", "success"];

/** Where the sphere is turned and how large it is, for the seal laid over it. */
export interface FrameInfo {
  yaw: number;
  pitch: number;
  scale: number;
}

function fract(value: number): number {
  return value - Math.floor(value);
}

/** Draws the agent orb on a 2D canvas: dots on a sphere, deal glyphs among them, a dust shell, state effects. */
export class OrbRenderer {
  readonly spin = new Spin();
  onFrame?: (info: FrameInfo) => void;

  private readonly ctx: CanvasRenderingContext2D;
  private palette: OrbPalette;
  private points: Float32Array = new Float32Array(0);
  private readonly dust: Float32Array = dustShell(DUST_COUNT, DUST_INNER, DUST_OUTER);
  private glyphs: string[] = [];
  private digits = "";
  private sx = new Float32Array(0);
  private sy = new Float32Array(0);
  private depthBucket = new Uint8Array(0);
  private bandBucket = new Uint8Array(0);
  private effectBucket = new Int8Array(0);
  private size = 0;
  private dpr = 1;
  private state: OrbState = "idle";
  private target: OrbParams = orbParams("idle");
  private params: OrbParams = orbParams("idle");
  private toneStrength: Record<Tone, number> = { accent: 0, warn: 0, danger: 0, success: 0 };
  private enteredAt = -10;
  private level = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private active = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    palette: OrbPalette,
    private readonly reducedMotion: boolean,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available.");
    this.ctx = ctx;
    this.palette = palette;
  }

  resize(size: number, devicePixelRatio: number): void {
    const dpr = Math.min(2, Math.max(1, devicePixelRatio));
    if (size === this.size && dpr === this.dpr) return;
    this.size = size;
    this.dpr = dpr;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    const count = dotCountFor(size);
    if (count * 3 !== this.points.length) {
      this.points = fibonacciSphere(count);
      this.sx = new Float32Array(count);
      this.sy = new Float32Array(count);
      this.depthBucket = new Uint8Array(count);
      this.bandBucket = new Uint8Array(count);
      this.effectBucket = new Int8Array(count);
      this.buildGlyphs();
    }
    this.redrawIfStill();
  }

  setPalette(palette: OrbPalette): void {
    this.palette = palette;
    this.redrawIfStill();
  }

  setState(state: OrbState): void {
    if (state === this.state) return;
    this.state = state;
    this.target = orbParams(state);
    this.enteredAt = this.time;
    this.redrawIfStill();
  }

  setDigits(digits: string): void {
    if (digits === this.digits) return;
    this.digits = digits;
    this.buildGlyphs();
    this.redrawIfStill();
  }

  /** Microphone level 0..1, already smoothed by the caller. */
  setLevel(level: number): void {
    this.level = level;
  }

  /** Runs the animation loop, or draws one still frame when motion is reduced. */
  play(): void {
    if (this.reducedMotion) {
      this.drawStill();
      return;
    }
    if (this.active) return;
    this.active = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause(): void {
    this.active = false;
    cancelAnimationFrame(this.raf);
  }

  private buildGlyphs(): void {
    const count = this.points.length / 3;
    this.glyphs = [];
    for (let i = 0; i < count; i++) this.glyphs.push(isGlyph(i) ? glyphFor(this.digits, i) : "");
  }

  private redrawIfStill(): void {
    if (this.reducedMotion && this.size > 0) this.drawStill();
  }

  private tick = (now: number): void => {
    if (!this.active) return;
    const dt = Math.min(MAX_DT, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.params = approachParams(this.params, this.target, dt);
    const keep = easeFactor(dt);
    for (const tone of TONES) {
      const goal = this.params.tone === tone ? 1 : 0;
      this.toneStrength[tone] = goal + (this.toneStrength[tone] - goal) * keep;
    }
    this.spin.step(dt, spinRate(this.params.turnsPerMinute));
    this.draw(this.time - this.enteredAt);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** One frame in the state's settled look: band mid-sweep, ring complete, colour at full strength. */
  private drawStill(): void {
    this.params = this.target;
    for (const tone of TONES) this.toneStrength[tone] = this.target.tone === tone ? 1 : 0;
    this.time = BAND_PERIOD / 2;
    this.spin.yaw = 0.6;
    this.draw(SWEEP_SECONDS);
  }

  private radiusScale(since: number): number {
    const { breathe, contraction, levelGain } = this.params;
    const breath = breathe * Math.sin((this.time / BREATH_PERIOD) * Math.PI * 2);
    return 1 + breath - contractionAt(contraction, since) + levelGain * this.level;
  }

  /** How strongly point (x, y, z) takes the state colour, 0..1. */
  private effect(x: number, y: number, z: number, since: number): number {
    const { band, ripple, rim, sweep } = this.params;
    let e = 0;
    if (band > 0.01) {
      const at = 1 - 2 * fract(this.time / BAND_PERIOD);
      e += band * Math.max(0, 1 - Math.abs(y - at) / 0.2);
    }
    if (ripple > 0.01) {
      const at = fract(this.time / RIPPLE_PERIOD) * 1.1;
      const r = Math.sqrt(x * x + y * y);
      e += ripple * Math.max(0, 1 - Math.abs(r - at) / 0.1) * (1 - at / 1.1) * (z > 0 ? 1 : 0.4);
    }
    if (rim > 0.01) {
      const edge = Math.pow(1 - Math.abs(z), 2.4);
      const pulse = this.state === "approval" ? 0.78 + 0.22 * Math.sin((this.time / PULSE_PERIOD) * Math.PI * 2) : 1;
      e += rim * edge * pulse;
    }
    if (sweep > 0.01) {
      const progress = Math.min(1, since / SWEEP_SECONDS);
      const fade = since < SWEEP_SECONDS + SWEEP_HOLD ? 1 : Math.exp(-(since - SWEEP_SECONDS - SWEEP_HOLD) * 1.2);
      const angle = fract(Math.atan2(x, y) / (Math.PI * 2) + 1);
      if (angle <= progress) e += sweep * fade * (progress - angle < 0.06 ? 1 : 0.55);
    }
    return Math.min(1, e);
  }

  private draw(since: number): void {
    const { ctx, size, dpr, palette } = this;
    if (size === 0) return;
    const count = this.points.length / 3;
    const centre = size / 2;
    const scale = this.radiusScale(since);
    const radius = size * RADIUS * scale;
    const cosYaw = Math.cos(this.spin.yaw);
    const sinYaw = Math.sin(this.spin.yaw);
    const cosPitch = Math.cos(this.spin.pitch);
    const sinPitch = Math.sin(this.spin.pitch);
    const bands = palette.bands.length;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";

    if (palette.glow) {
      const glow = ctx.createRadialGradient(centre, centre, radius * 0.2, centre, centre, radius * 1.45);
      glow.addColorStop(0, palette.glow);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
    }

    this.drawDust(centre, radius, size);

    // Project every point and sort it into a depth, colour band and effect bucket.
    for (let i = 0; i < count; i++) {
      const px = this.points[i * 3];
      const py = this.points[i * 3 + 1];
      const pz = this.points[i * 3 + 2];
      const x1 = px * cosYaw - pz * sinYaw;
      const z1 = px * sinYaw + pz * cosYaw;
      const y2 = py * cosPitch - z1 * sinPitch;
      const z2 = py * sinPitch + z1 * cosPitch;
      const perspective = 1 + z2 * 0.08;
      this.sx[i] = centre + x1 * radius * perspective;
      this.sy[i] = centre - y2 * radius * perspective;
      this.depthBucket[i] = Math.min(DEPTH_LEVELS - 1, Math.floor(((z2 + 1) / 2) * DEPTH_LEVELS));
      this.bandBucket[i] = Math.min(bands - 1, Math.floor(((1 - y2) / 2) * bands));
      const e = this.effect(x1, y2, z2, since);
      this.effectBucket[i] = e < 0.08 ? -1 : Math.min(EFFECT_LEVELS - 1, Math.floor(e * EFFECT_LEVELS));
    }

    const dot = Math.max(0.9, (size / 440) * 1.45) * palette.dot;
    ctx.globalCompositeOperation = palette.theme === "dark" ? "lighter" : "source-over";

    for (let depth = 0; depth < DEPTH_LEVELS; depth++) {
      const share = depth / (DEPTH_LEVELS - 1);
      const alpha = palette.back + (palette.front - palette.back) * share * share;
      const s = dot * (0.8 + 0.35 * share);
      for (let band = 0; band < bands; band++) {
        ctx.fillStyle = palette.bands[band];
        ctx.globalAlpha = alpha;
        for (let i = 0; i < count; i++) {
          if (this.depthBucket[i] !== depth || this.bandBucket[i] !== band || this.glyphs[i]) continue;
          ctx.fillRect(this.sx[i] - s / 2, this.sy[i] - s / 2, s, s);
        }
      }
    }

    this.drawEffects(count, dot);
    this.drawGlyphs(count, radius);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    this.onFrame?.({ yaw: this.spin.yaw, pitch: this.spin.pitch, scale });
  }

  private drawDust(centre: number, radius: number, size: number): void {
    const { ctx, palette } = this;
    const turn = this.spin.yaw * 0.6 + this.time * 0.05;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const s = Math.max(0.8, (size / 440) * 1.2);
    ctx.fillStyle = palette.dust;
    ctx.globalAlpha = palette.theme === "dark" ? 0.22 : 0.16;
    for (let i = 0; i < DUST_COUNT; i++) {
      const x = this.dust[i * 3];
      const y = this.dust[i * 3 + 1];
      const z = this.dust[i * 3 + 2];
      const x1 = x * cos - z * sin;
      ctx.fillRect(centre + x1 * radius - s / 2, centre - y * radius - s / 2, s, s);
    }
  }

  private drawEffects(count: number, dot: number): void {
    const { ctx, palette } = this;
    const s = dot * 1.3;
    for (const tone of TONES) {
      const strength = this.toneStrength[tone];
      if (strength < 0.02) continue;
      ctx.fillStyle = palette.tones[tone];
      for (let level = 0; level < EFFECT_LEVELS; level++) {
        for (let front = 0; front < 2; front++) {
          ctx.globalAlpha = strength * ((level + 1) / EFFECT_LEVELS) * (front ? 0.95 : 0.35);
          for (let i = 0; i < count; i++) {
            if (this.effectBucket[i] !== level || this.glyphs[i]) continue;
            if ((this.depthBucket[i] >= DEPTH_LEVELS / 2 ? 1 : 0) !== front) continue;
            ctx.fillRect(this.sx[i] - s / 2, this.sy[i] - s / 2, s, s);
          }
        }
      }
    }
  }

  private drawGlyphs(count: number, radius: number): void {
    const { ctx, palette } = this;
    const fontSize = Math.max(6.5, radius * 0.068);
    ctx.font = `500 ${fontSize}px ${palette.fontMono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < count; i++) {
      const glyph = this.glyphs[i];
      if (!glyph) continue;
      const depth = this.depthBucket[i];
      if (depth < 1) continue;
      const share = depth / (DEPTH_LEVELS - 1);
      const level = this.effectBucket[i];
      ctx.fillStyle = level >= 1 ? palette.tones[this.params.tone === "none" ? "accent" : this.params.tone] : palette.glyph;
      ctx.globalAlpha = (palette.theme === "dark" ? 0.75 : 0.7) * share;
      ctx.fillText(glyph, this.sx[i], this.sy[i]);
    }
  }
}
