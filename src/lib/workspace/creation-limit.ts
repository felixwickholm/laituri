/** Whether one more sandbox may be made for a client address now, and if not, in how many seconds. */
export type Admission = { allowed: true } | { allowed: false; retryAfterS: number };

export interface CreationLimit {
  /** Counts one, or refuses when the window is used up. */
  admit(address: string): Admission;
  /** Whether the next admit would be refused, without counting. */
  check(address: string): Admission;
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

  function look(address: string): { window: Window; admission: Admission } {
    const now = clock();
    forget(now);
    const window = windows.get(address) ?? { startedAt: now, count: 0 };
    if (window.count >= options.max()) {
      return { window, admission: { allowed: false, retryAfterS: Math.max(1, Math.ceil((window.startedAt + options.windowMs - now) / 1000)) } };
    }
    return { window, admission: { allowed: true } };
  }

  return {
    admit(address) {
      const { window, admission } = look(address);
      if (!admission.allowed) return admission;
      window.count += 1;
      windows.set(address, window);
      return admission;
    },
    check: (address) => look(address).admission,
  };
}

export const CREATION_WINDOW_MS = 10 * 60_000;
export const DEFAULT_CREATIONS_PER_WINDOW = 5;

/** Browsers share addresses (an event's Wi-Fi), so a browser's first visit has a larger allowance than a script. */
export const DEFAULT_BROWSER_CREATIONS_PER_WINDOW = 40;

function positive(raw: string | undefined, fallback: number): number {
  const value = Number(raw?.trim());
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** LAITURI_SANDBOX_CREATE_PER_10_MIN, else five sandboxes per address in ten minutes. */
export function creationsPerWindow(): number {
  return positive(process.env.LAITURI_SANDBOX_CREATE_PER_10_MIN, DEFAULT_CREATIONS_PER_WINDOW);
}

/** LAITURI_SANDBOX_BROWSER_PER_10_MIN, else forty browser sandboxes per address in ten minutes. */
export function browserCreationsPerWindow(): number {
  return positive(process.env.LAITURI_SANDBOX_BROWSER_PER_10_MIN, DEFAULT_BROWSER_CREATIONS_PER_WINDOW);
}
