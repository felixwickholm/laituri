import { stepMs } from "@/lib/demo/activity";

/** A basket line takes about three steps; the single-purchase pace would make a 20-line basket take half a minute. */
const MAX_BASKET_STEP_MS = 500;

/**
 * The pause between steps of a basket line: LAITURI_BASKET_STEP_MS when set, else the demo pace capped so a 20-line
 * basket finishes in well under ten seconds. Zero where the demo pace is zero, as in tests and evals.
 */
export function basketStepMs(): number {
  const configured = Number(process.env.LAITURI_BASKET_STEP_MS);
  if (process.env.LAITURI_BASKET_STEP_MS !== undefined && Number.isFinite(configured) && configured >= 0) return configured;
  return Math.min(stepMs(), MAX_BASKET_STEP_MS);
}
