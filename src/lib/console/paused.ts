import { ApiError } from "./api";

export const AUDIT_BROKEN = "audit_broken";
export const PAUSED_LABEL = "Paused: the record was changed";
export const PAUSED_NOTE = "Press Reset to put the record back.";

/** The server refuses approvals while the record does not check out; say so in plain words. */
export function pausedMessage(error: unknown): string | undefined {
  return error instanceof ApiError && error.code === AUDIT_BROKEN ? `${PAUSED_LABEL}. ${PAUSED_NOTE}` : undefined;
}

/** Every read answered 401 credential_required: the shell explains the sign-in once; screens say only this. */
export const LOCKED_NOTE = "This workspace needs a sign-in to read.";
