import { createHash, timingSafeEqual } from "node:crypto";
import { currentWorkspace } from "@/lib/workspace/context";
import { ForbiddenError } from "./agent";
import type { SessionRole } from "./session-token";

/**
 * "passcode": the person must know the role's passcode. "open": anyone may sign in, which only a local development
 * server allows. "closed": no passcode is set on a production server, so nobody can sign in over the network.
 */
export type SignInMode = "passcode" | "open" | "closed";

/** What a signed audit entry says about an action taken in a demo access session. */
export const DEMO_VIA = "demo access";

const PASSCODE_ENV: Record<SessionRole, string> = {
  approver: "LAITURI_APPROVER_PASSCODE",
  operator: "LAITURI_OPERATOR_PASSCODE",
};

function passcode(role: SessionRole): string | undefined {
  return process.env[PASSCODE_ENV[role]]?.trim() || undefined;
}

export function signInMode(role: SessionRole): SignInMode {
  if (passcode(role)) return "passcode";
  return process.env.NODE_ENV === "production" ? "closed" : "open";
}

function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/** Throws unless `given` signs in this role: the right passcode, or any input on an open development server. */
export function checkPasscode(role: SessionRole, given: string | undefined): void {
  const mode = signInMode(role);
  if (mode === "closed") {
    throw new ForbiddenError(`Signing in as the ${role} is turned off: no ${PASSCODE_ENV[role]} is set on this server.`, "sign_in_unavailable");
  }
  const expected = passcode(role);
  if (expected && !(given && sameSecret(given, expected))) throw new ForbiddenError("The passcode is not correct.", "wrong_passcode");
}

/** LAITURI_DEMO_ACCESS=off turns one-click demo access off; it is on by default. */
export function demoAccessEnabled(): boolean {
  return process.env.LAITURI_DEMO_ACCESS?.trim().toLowerCase() !== "off";
}

/**
 * Demo access is offered only inside a sandbox, to the browser that holds its cookie: what it approves there touches
 * nobody else. Agent credentials are refused before this, so a sandbox reached here was reached by its cookie.
 */
export function demoAccessHere(): boolean {
  return demoAccessEnabled() && currentWorkspace().kind === "sandbox";
}

export function requireDemoAccess(): void {
  if (!demoAccessEnabled()) throw new ForbiddenError("Demo access is turned off. Sign in with the passcode.", "demo_access_off");
  if (!demoAccessHere()) {
    throw new ForbiddenError("Demo access works only in your own sandbox. The shared workspace needs the passcode.", "demo_access_sandbox_only");
  }
}
