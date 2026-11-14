/** How many sandboxes live at once and how long an unused one is kept. */
export interface SandboxLimits {
  max: number;
  idleMs: number;
}

/** Each sandbox holds a copy of the seeded week (well under a megabyte of JSON), so 50 fit easily in memory. */
export const DEFAULT_SANDBOX_MAX = 50;
export const DEFAULT_SANDBOX_IDLE_MINUTES = 60;

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw?.trim());
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** LAITURI_SANDBOX_MAX and LAITURI_SANDBOX_IDLE_MINUTES, else the defaults. */
export function sandboxLimits(): SandboxLimits {
  return {
    max: positiveInteger(process.env.LAITURI_SANDBOX_MAX, DEFAULT_SANDBOX_MAX),
    idleMs: positiveInteger(process.env.LAITURI_SANDBOX_IDLE_MINUTES, DEFAULT_SANDBOX_IDLE_MINUTES) * 60_000,
  };
}
