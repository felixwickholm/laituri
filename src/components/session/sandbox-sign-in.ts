import { demoOffered, roleSession } from "@/lib/console/session";
import type { ConsoleSession, SessionRole } from "@/lib/console/types";

const ROLES: readonly SessionRole[] = ["approver", "operator"];

/**
 * In a visitor's own sandbox the purchasing manager and the Valio Aimo operator are simply signed in: these are the
 * roles still missing a session. Anywhere else (the shared workspace, production without demo access) nobody is
 * signed in for you, and the passcode stays the way in.
 */
export function rolesToSignIn(session: ConsoleSession | undefined): SessionRole[] {
  if (!demoOffered(session)) return [];
  return ROLES.filter((role) => !roleSession(session, role).signedIn);
}
