/** Single source of time. LAITURI_NOW pins the clock so recorded upstream data stays consistent in tests and evals. */
export function now(): Date {
  const pinned = process.env.LAITURI_NOW;
  return pinned ? new Date(pinned) : new Date();
}
