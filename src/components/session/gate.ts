"use client";

import { ApiError, SIGN_IN_REQUIRED } from "@/lib/console/api";
import { consoleStore } from "@/lib/console/store";

export interface SignInRequest {
  anchor: DOMRect;
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

/** Opens the sign-in popover next to `anchor`; resolves true once the approver is signed in. */
export function requestSignIn(anchor: Element | null): Promise<boolean> {
  current?.resolve(false);
  const rect = anchor?.getBoundingClientRect() ?? new DOMRect(window.innerWidth - 24, 52, 0, 0);
  return new Promise((resolve) => {
    current = {
      anchor: rect,
      resolve: (signedIn) => {
        current = null;
        emit();
        resolve(signedIn);
      },
    };
    emit();
  });
}

/**
 * Runs a human-only action as the signed-in approver. Signs in first when needed, and once more
 * if the server says the session has ended. Returns undefined when the person cancels sign-in.
 */
export async function withApprover<T>(anchor: Element | null, action: () => Promise<T>): Promise<T | undefined> {
  if (!consoleStore.getSnapshot().session?.signedIn && !(await requestSignIn(anchor))) return undefined;
  try {
    return await action();
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== SIGN_IN_REQUIRED) throw error;
    consoleStore.markSignedOut();
    if (!(await requestSignIn(anchor))) return undefined;
    return action();
  }
}
