/** Whether one more sandbox may be made for a client address now, and if not, in how many seconds. */
export type Admission = { allowed: true } | { allowed: false; retryAfterS: number };

export interface CreationLimit {
  admit(address: string): Admission;
}

export interface CreationLimitOptions {
  /** Read on every call, so a changed setting applies at once. */
  max: () => number;
  windowMs: number;
  clock?: () => number;
}

interface Window {
  startedAt: number;
  count: number;
}

/** A fixed window per address: at most `max` sandboxes per address in each window. Expired windows are dropped as calls come. */
export function createCreationLimit(options: CreationLimitOptions): CreationLimit {
  const clock = options.clock ?? Date.now;
  const windows = new Map<string, Window>();

  function forget(now: number): void {
    for (const [address, window] of windows) if (now - window.startedAt >= options.windowMs) windows.delete(address);
  }

  return {
    admit(address) {
      const now = clock();
      forget(now);
      const window = windows.get(address) ?? { startedAt: now, count: 0 };
      if (window.count >= options.max()) {
        return { allowed: false, retryAfterS: Math.ceil((window.startedAt + options.windowMs - now) / 1000) };
      }
      window.count += 1;
      windows.set(address, window);
      return { allowed: true };
    },
  };
}

export const CREATION_WINDOW_MS = 10 * 60_000;
export const DEFAULT_CREATIONS_PER_WINDOW = 5;

/** LAITURI_SANDBOX_CREATE_PER_10_MIN, else five sandboxes per address in ten minutes. */
export function creationsPerWindow(): number {
  const value = Number(process.env.LAITURI_SANDBOX_CREATE_PER_10_MIN?.trim());
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_CREATIONS_PER_WINDOW;
}
