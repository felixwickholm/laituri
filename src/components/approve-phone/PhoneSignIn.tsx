"use client";

import { useState, type FormEvent } from "react";
import { demoOffered, signInError } from "@/lib/console/session";
import { consoleStore } from "@/lib/console/store";
import type { ConsoleSession, SignInCredentials } from "@/lib/console/types";

/**
 * Signed out on the phone. In a visitor's sandbox the purchasing manager is signed in automatically on page load
 * (SandboxSignIn), so this only holds the place of the decision buttons for that moment. Elsewhere the approver's
 * passcode is the way in. It keeps the height of the two decision buttons, so signing in does not move the page.
 */
export function PhoneSignIn({ session }: { session?: ConsoleSession; what?: string }) {
  const auto = demoOffered(session);
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

  if (auto) {
    return (
      <div className="ph-actions" aria-live="polite">
        <p className="ph-fine">Signing in…</p>
      </div>
    );
  }

  return (
    <form className="ph-actions" onSubmit={submit}>
      <label className="field-label" htmlFor="ph-passcode">
        Passcode
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
      {error ? (
        <p className="ph-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
