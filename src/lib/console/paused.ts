import { ApiError } from "./api";

export const AUDIT_BROKEN = "audit_broken";
export const PAUSED_LABEL = "Paused: the log is broken";
export const PAUSED_NOTE = "Press Reset to restore the log.";

/** The server refuses approvals while the log does not verify; say so in the console's own words. */
export function pausedMessage(error: unknown): string | undefined {
  return error instanceof ApiError && error.code === AUDIT_BROKEN ? `${PAUSED_LABEL}. ${PAUSED_NOTE}` : undefined;
}
