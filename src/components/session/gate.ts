"use client";

import { ApiError, OPERATOR_SIGN_IN_REQUIRED, SHARED_READ_ONLY, SIGN_IN_REQUIRED } from "@/lib/console/api";
import { roleSession } from "@/lib/console/session";
import { consoleStore } from "@/lib/console/store";
import type { SessionRole } from "@/lib/console/types";

/** Which way in the popover offers first: one-click demo access, or the role's passcode. */
export type SignInStart = "demo" | "passcode";

export interface SignInRequest {
  anchor: DOMRect;
  start: SignInStart;
  role: SessionRole;
  resolve: (signedIn: boolean) => void;
}

let current: SignInRequest | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeSignIn(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentSignIn(): SignInRequest | null {
  return current;
}

/** Opens the sign-in popover next to `anchor`; resolves true once the person is signed in for `role`. */
export function requestSignIn(anchor: Element | null, start: SignInStart = "demo", role: SessionRole = "approver"): Promise<boolean> {
  current?.resolve(false);
  const rect = anchor?.getBoundingClientRect() ?? new DOMRect(window.innerWidth - 24, 52, 0, 0);
  return new Promise((resolve) => {
    current = {
      anchor: rect,
      start,
      role,
      resolve: (signedIn) => {
        current = null;
        emit();
        resolve(signedIn);
      },
    };
    emit();
  });
}

/** The server's codes that mean "sign in as this role and try again". */
const SIGN_IN_CODES: Record<SessionRole, readonly string[]> = {
  approver: [SIGN_IN_REQUIRED, SHARED_READ_ONLY],
  operator: [OPERATOR_SIGN_IN_REQUIRED, SHARED_READ_ONLY],
};

export function needsSignIn(error: unknown, role: SessionRole): boolean {
  return error instanceof ApiError && error.code !== undefined && SIGN_IN_CODES[role].includes(error.code);
}

/**
 * Runs a person-only action as `role`. Signs in first when needed, and once more if the server says the session
 * has ended (or that the shared workspace needs one). Returns undefined when the person cancels sign-in.
 */
export async function withRole<T>(role: SessionRole, anchor: Element | null, action: () => Promise<T>): Promise<T | undefined> {
  if (!roleSession(consoleStore.getSnapshot().session, role).signedIn && !(await requestSignIn(anchor, "demo", role))) return undefined;
  try {
    return await action();
  } catch (error) {
    if (!needsSignIn(error, role)) throw error;
    consoleStore.markSignedOut(role);
    if (!(await requestSignIn(anchor, "demo", role))) return undefined;
    return action();
  }
}

/** A buyer-side decision: approving, rejecting or changing the mandate needs the approver. */
export function withApprover<T>(anchor: Element | null, action: () => Promise<T>): Promise<T | undefined> {
  return withRole("approver", anchor, action);
}

/** A wholesaler control: suspending or resuming an agent needs the Valio Aimo operator. */
export function withOperator<T>(anchor: Element | null, action: () => Promise<T>): Promise<T | undefined> {
  return withRole("operator", anchor, action);
}
