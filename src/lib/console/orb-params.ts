/** What the agent orb shows. One state at a time; the orb eases between them. */
export type OrbState = "idle" | "thinking" | "acting" | "approval" | "blocked" | "signed" | "listening";

export const ORB_STATES: readonly OrbState[] = ["idle", "thinking", "acting", "approval", "blocked", "signed", "listening"];

/** The colour role a state tints the orb with. "none" keeps the plain ink. */
export type OrbTone = "none" | "accent" | "warn" | "danger" | "success";

/** Everything the renderer needs to draw one state. Numbers ease towards these over about 600 ms. */
export interface OrbParams {
  /** Turns per minute around the vertical axis. */
  turnsPerMinute: number;
  /** Breathing amplitude as a share of the radius. */
  breathe: number;
  /** 0..1: a highlight band that sweeps top to bottom. */
  band: number;
  /** 0..1: rings that run outwards from the centre. */
  ripple: number;
  /** 0..1: how strongly the silhouette takes the state colour. */
  rim: number;
  /** One-off shrink on entering the state, as a share of the radius. */
  contraction: number;
  /** 0..1: a sweep of colour around the sphere on entering the state. */
  sweep: number;
  /** How much the radius follows the microphone level. */
  levelGain: number;
  tone: OrbTone;
}

const BASE: OrbParams = {
  turnsPerMinute: 1,
  breathe: 0.012,
  band: 0,
  ripple: 0,
  rim: 0,
  contraction: 0,
  sweep: 0,
  levelGain: 0,
  tone: "none",
};

const PARAMS: Record<OrbState, OrbParams> = {
  idle: BASE,
  thinking: { ...BASE, turnsPerMinute: 3, breathe: 0.006, band: 1, tone: "accent" },
  acting: { ...BASE, turnsPerMinute: 2.5, breathe: 0.004, ripple: 1, tone: "accent" },
  approval: { ...BASE, turnsPerMinute: 0, breathe: 0.008, rim: 1, tone: "warn" },
  blocked: { ...BASE, turnsPerMinute: 0.6, breathe: 0, rim: 0.35, contraction: 0.12, tone: "danger" },
  signed: { ...BASE, turnsPerMinute: 1.5, breathe: 0.01, sweep: 1, tone: "success" },
  listening: { ...BASE, turnsPerMinute: 1.3, breathe: 0, rim: 0.25, levelGain: 0.2, tone: "accent" },
};

export function orbParams(state: OrbState): OrbParams {
  return PARAMS[state];
}

/** Radians per second for a number of turns per minute. */
export function spinRate(turnsPerMinute: number): number {
  return (turnsPerMinute * Math.PI * 2) / 60;
}

/** Shrink at `seconds` after entering a contracting state: in fast over 150 ms, back out over about a second. */
export function contractionAt(amount: number, seconds: number): number {
  if (amount <= 0 || seconds < 0) return 0;
  const IN = 0.15;
  if (seconds < IN) return amount * (seconds / IN);
  return amount * Math.exp(-(seconds - IN) * 4);
}

/** Exponential approach: the share of the remaining distance left after `dt` seconds, settling in about 600 ms. */
export function easeFactor(dt: number, settleSeconds = 0.6): number {
  return Math.exp(-dt / (settleSeconds / 4));
}

/** Moves every number in `from` towards `to`; the tone switches at once, the renderer fades colour separately. */
export function approachParams(from: OrbParams, to: OrbParams, dt: number): OrbParams {
  const keep = easeFactor(dt);
  const step = (a: number, b: number) => b + (a - b) * keep;
  return {
    turnsPerMinute: step(from.turnsPerMinute, to.turnsPerMinute),
    breathe: step(from.breathe, to.breathe),
    band: step(from.band, to.band),
    ripple: step(from.ripple, to.ripple),
    rim: step(from.rim, to.rim),
    contraction: to.contraction,
    sweep: to.sweep,
    levelGain: step(from.levelGain, to.levelGain),
    tone: to.tone,
  };
}

/** The words a screen reader hears for a state. */
export const ORB_STATE_WORDS: Record<OrbState, string> = {
  idle: "Idle",
  thinking: "Thinking",
  acting: "Calling a tool",
  approval: "Waiting for a person",
  blocked: "Stopped by a rule",
  signed: "Signed and confirmed",
  listening: "Listening",
};
