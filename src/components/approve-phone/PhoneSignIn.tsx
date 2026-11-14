"use client";

import { useState, type FormEvent } from "react";
import { ApiError, WRONG_PASSCODE } from "@/lib/console/api";
import { demoOffered } from "@/lib/console/session";
import { consoleStore } from "@/lib/console/store";
import type { ConsoleSession, SignInCredentials } from "@/lib/console/types";

/** Signed out on the phone: one-click demo access first, the approver passcode as the other way in. */
export function PhoneSignIn({ session, approver }: { session?: ConsoleSession; approver: string }) {
  const demo = demoOffered(session);
  const [passcodeMode, setPasscodeMode] = useState(!demo);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(credentials: SignInCredentials) {
    setBusy(true);
    setError(null);
    try {
      await consoleStore.signIn(credentials);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.code === WRONG_PASSCODE ? "That passcode is not correct." : "Sign-in did not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (passcode) void signIn({ passcode });
  }

  return (
    <div className="ph-actions">
      <p className="ph-note">Only {approver} can decide this order. Sign in to approve or reject it.</p>
      {passcodeMode ? (
        <form className="ph-form" onSubmit={submit}>
          <label className="ph-label" htmlFor="ph-passcode">
            Approver passcode
          </label>
          <input
            id="ph-passcode"
            className="ph-input"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
          />
          <button type="submit" className="ph-btn ph-primary" disabled={busy || passcode === ""}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {demo ? (
            <button type="button" className="ph-link" onClick={() => setPasscodeMode(false)}>
              Continue with demo access instead
            </button>
          ) : null}
        </form>
      ) : (
        <>
          <button type="button" className="ph-btn ph-primary" disabled={busy} onClick={() => void signIn({ demo: true })}>
            {busy ? "Signing in…" : "Continue with demo access"}
          </button>
          {session?.mode === "passcode" ? (
            <button type="button" className="ph-link" onClick={() => setPasscodeMode(true)}>
              Use the approver passcode
            </button>
          ) : null}
          <p className="ph-fine">Demo access signs you in as {approver}, the demo approver. Every decision is still signed and logged.</p>
        </>
      )}
      {error ? (
        <p className="ph-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
