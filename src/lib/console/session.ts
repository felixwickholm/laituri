import type { ConsoleSession } from "./types";

/** The server offers one-click demo access. Until it says so, an open server counts as offering it. */
export function demoOffered(session: ConsoleSession | undefined): boolean {
  return session?.demoAccess ?? session?.mode !== "passcode";
}

/** The person signed in through demo access, not with the approver's passcode. */
export function isDemoSession(session: ConsoleSession | undefined): boolean {
  if (!session?.signedIn) return false;
  return session.demo ?? session.mode === "open";
}
