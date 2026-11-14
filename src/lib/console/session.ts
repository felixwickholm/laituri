import { ApiError, WRONG_PASSCODE } from "./api";
import type { ConsoleSession, SessionRole, SignInMode } from "./types";

/** One role's side of the session, in the same shape for the approver and the operator. */
export interface RoleSession {
  signedIn: boolean;
  name?: string;
  demo: boolean;
  mode: SignInMode;
}

/** The approver's or the operator's side of this browser's session. */
export function roleSession(session: ConsoleSession | undefined, role: SessionRole): RoleSession {
  if (role === "operator") {
    const operator = session?.operator;
    return { signedIn: operator?.signedIn === true, name: operator?.operator?.name, demo: operator?.demo === true, mode: operator?.mode ?? "open" };
  }
  return { signedIn: session?.signedIn === true, name: session?.approver?.name, demo: session?.demo === true, mode: session?.mode ?? "open" };
}

/** One-click demo access is offered only when the server says so: in the visitor's own sandbox. */
export function demoOffered(session: ConsoleSession | undefined): boolean {
  return session?.demoAccess === true;
}

/** Whether the role signs in with a passcode here: always when one is set, and on an open server when demo access is off. */
export function passcodeOffered(session: ConsoleSession | undefined, role: SessionRole): boolean {
  const { mode } = roleSession(session, role);
  return mode === "passcode" || (mode === "open" && !demoOffered(session));
}

/** The person signed in for this role through demo access, not with a passcode. */
export function isDemoSession(session: ConsoleSession | undefined, role: SessionRole = "approver"): boolean {
  const side = roleSession(session, role);
  return side.signedIn && side.demo;
}

/** The session with one role signed out, the other kept as it was. */
export function withoutRole(session: ConsoleSession, role?: SessionRole): ConsoleSession {
  const approverOut = role === undefined || role === "approver";
  const operatorOut = role === undefined || role === "operator";
  return {
    ...session,
    ...(approverOut ? { signedIn: false, approver: undefined, buyer: undefined, demo: undefined } : {}),
    operator: operatorOut ? { signedIn: false, mode: session.operator.mode } : session.operator,
  };
}

/** The server's own sentence when it refused a sign-in, a plain one when it was not reached. */
export function signInError(failure: unknown): string {
  if (!(failure instanceof ApiError)) return "Sign-in did not reach the server.";
  return failure.code === WRONG_PASSCODE ? "That passcode is not correct." : failure.detail;
}
