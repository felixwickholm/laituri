import { callerAddress } from "@/lib/http/caller";
import { createCreationLimit, type CreationLimit } from "@/lib/workspace/creation-limit";

/**
 * One budget for every call to a paid model (the assistant's reading, the menu planner's reading, a free-text agent
 * run), kept for the whole process on globalThis like the other cross-workspace state. A caller over its address's
 * share, or any caller once the day's budget is spent, gets the rule-based path instead: never an error.
 */
export interface ModelBudget {
  /** Counts one model call for `address` and says whether it may run. */
  admit(address: string): boolean;
  /** Calls admitted today. */
  usedToday(): number;
}

export interface ModelBudgetOptions {
  perDay: () => number;
  perAddress: () => number;
  windowMs: number;
  clock?: () => number;
}

export const DEFAULT_MODEL_CALLS_PER_DAY = 2_000;
export const DEFAULT_MODEL_CALLS_PER_ADDRESS = 60;
export const MODEL_ADDRESS_WINDOW_MS = 10 * 60_000;

export function createModelBudget(options: ModelBudgetOptions): ModelBudget {
  const clock = options.clock ?? Date.now;
  const perAddress: CreationLimit = createCreationLimit({ max: options.perAddress, windowMs: options.windowMs, clock });
  let day = "";
  let used = 0;

  function rollOver(): void {
    const current = new Date(clock()).toISOString().slice(0, 10);
    if (current === day) return;
    day = current;
    used = 0;
  }

  return {
    admit(address) {
      rollOver();
      if (used >= options.perDay()) return false;
      if (!perAddress.admit(address).allowed) return false;
      used += 1;
      return true;
    },
    usedToday() {
      rollOver();
      return used;
    },
  };
}

function positive(raw: string | undefined, fallback: number): number {
  const value = Number(raw?.trim());
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const holder = globalThis as typeof globalThis & { __laituriModelBudget?: ModelBudget };

/** LAITURI_MODEL_CALLS_PER_DAY (2,000) and LAITURI_MODEL_CALLS_PER_ADDRESS_PER_10_MIN (60). */
export function modelBudget(): ModelBudget {
  return (holder.__laituriModelBudget ??= createModelBudget({
    perDay: () => positive(process.env.LAITURI_MODEL_CALLS_PER_DAY, DEFAULT_MODEL_CALLS_PER_DAY),
    perAddress: () => positive(process.env.LAITURI_MODEL_CALLS_PER_ADDRESS_PER_10_MIN, DEFAULT_MODEL_CALLS_PER_ADDRESS),
    windowMs: MODEL_ADDRESS_WINDOW_MS,
  }));
}

/** Whether the current request may call a paid model now. Each true counts against the budget. */
export function admitModelCall(): boolean {
  return modelBudget().admit(callerAddress());
}
