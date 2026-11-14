"use client";

import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { demoOffered, passcodeOffered, signInError } from "@/lib/console/session";
import { consoleStore } from "@/lib/console/store";
import type { ConsoleSession, SignInCredentials } from "@/lib/console/types";

/**
 * Signed out on the phone: one-click demo access first, the approver passcode as the other way in. It keeps the
 * height of the two decision buttons, so signing in does not move the page.
 */
export function PhoneSignIn({ session, approver }: { session?: ConsoleSession; approver: string }) {
  const demo = demoOffered(session);
  const passcode = passcodeOffered(session, "approver") || session?.mode === "passcode";
  const [passcodeMode, setPasscodeMode] = useState(!demo);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(credentials: SignInCredentials) {
    setBusy(true);
    setError(null);
    try {
      await consoleStore.signIn(credentials);
    } catch (failure) {
      setError(signInError(failure));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code) void signIn({ passcode: code });
  }

  if (passcodeMode) {
    return (
      <form className="ph-actions" onSubmit={submit}>
        <label className="field-label" htmlFor="ph-passcode">
          {approver}’s passcode
        </label>
        <div className="ph-pair ph-pair-form">
          <input
            id="ph-passcode"
            className="text-field ph-field"
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoFocus
          />
          <button type="submit" className="btn big btn-primary" disabled={busy || code === ""}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
        {demo ? (
          <button type="button" className="text-link ph-other" onClick={() => setPasscodeMode(false)}>
            Use demo access instead
          </button>
        ) : null}
        {error ? (
          <p className="ph-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="ph-actions">
      <button type="button" className="btn big btn-primary wide" data-phone-demo disabled={busy} onClick={() => void signIn({ demo: true })}>
        {busy ? "Signing in…" : `Use demo access as ${approver}`}
      </button>
      <p className="ph-fine">
        Only {approver} can decide this order.
        {passcode ? (
          <>
            {" "}
            <button type="button" className="text-link ph-inline" onClick={() => setPasscodeMode(true)}>
              <KeyRound aria-hidden="true" />
              Sign in with the passcode
            </button>
          </>
        ) : null}
      </p>
      {error ? (
        <p className="ph-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
