"use client";

import { LockKeyhole, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ApiError, WRONG_PASSCODE } from "@/lib/console/api";
import { shortName } from "@/lib/console/format/rules";
import { demoOffered } from "@/lib/console/session";
import { consoleStore, useConsole } from "@/lib/console/store";
import type { SignInCredentials } from "@/lib/console/types";
import { useDismiss } from "../ui/useDismiss";
import { currentSignIn, subscribeSignIn, type SignInRequest } from "./gate";

const WIDTH = 320;
const GAP = 8;
const EDGE = 16;

function place(anchor: DOMRect): { left: number; top?: number; bottom?: number; origin: string } {
  const width = Math.min(WIDTH, window.innerWidth - EDGE * 2);
  const left = Math.min(Math.max(EDGE, anchor.left), window.innerWidth - width - EDGE);
  const below = anchor.bottom + GAP;
  const side = anchor.left - left > width / 2 ? "right" : "left";
  if (window.innerHeight - below > 300) return { left, top: below, origin: `top ${side}` };
  return { left, bottom: window.innerHeight - anchor.top + GAP, origin: `bottom ${side}` };
}

function Form({ request }: { request: SignInRequest }) {
  const { session, mandate } = useConsole();
  const demo = demoOffered(session);
  const [passcodeMode, setPasscodeMode] = useState(request.start === "passcode" || !demo);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cancel = useCallback(() => request.resolve(false), [request]);
  useDismiss(root, true, cancel);
  const approver = shortName(session?.approver?.name ?? mandate?.mandate.approval.approver.name ?? "the approver");

  useEffect(() => {
    root.current?.querySelector<HTMLElement>("input, .btn-primary")?.focus();
  }, [passcodeMode]);

  async function signIn(credentials: SignInCredentials) {
    setBusy(true);
    setError(null);
    try {
      await consoleStore.signIn(credentials);
      request.resolve(true);
    } catch (failure) {
      setBusy(false);
      setError(failure instanceof ApiError && failure.code === WRONG_PASSCODE ? "That passcode is not correct." : "Sign-in did not reach the server.");
    }
  }

  function submitPasscode(event: FormEvent) {
    event.preventDefault();
    if (passcode) void signIn({ passcode });
  }

  const spot = place(request.anchor);
  return (
    <div
      ref={root}
      className="popover signin"
      role="dialog"
      aria-labelledby="signin-title"
      style={{ position: "fixed", left: spot.left, top: spot.top, bottom: spot.bottom, width: Math.min(WIDTH, window.innerWidth - EDGE * 2), transformOrigin: spot.origin }}
    >
      <button type="button" className="icon-btn close" onClick={cancel} aria-label="Cancel sign-in">
        <X aria-hidden="true" />
      </button>
      <h3 id="signin-title">
        <LockKeyhole aria-hidden="true" />
        Only the approver can do this
      </h3>
      <p>Approvals, mandate changes and reset are signed with {approver}&rsquo;s approver key and written to the log.</p>
      {demo && !passcodeMode ? (
        <div className="signin-actions">
          <button type="button" className="btn btn-primary wide" disabled={busy} onClick={() => signIn({ demo: true })}>
            {busy ? "Signing in…" : "Continue with demo access"}
          </button>
          <p className="fine">Demo access signs you in as {approver}, the demo approver. Every decision is still signed and logged.</p>
          {session?.mode === "passcode" ? (
            <button type="button" className="text-link" onClick={() => setPasscodeMode(true)}>
              Use the approver passcode instead
            </button>
          ) : null}
        </div>
      ) : (
        <form className="signin-actions" onSubmit={submitPasscode}>
          <label className="field-label" htmlFor="approver-passcode">
            Approver passcode
          </label>
          <input
            id="approver-passcode"
            className="text-field"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
          />
          <button type="submit" className="btn btn-primary wide" disabled={busy || passcode === ""}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {demo ? (
            <button type="button" className="text-link" onClick={() => setPasscodeMode(false)}>
              Continue with demo access instead
            </button>
          ) : null}
        </form>
      )}
      {error ? (
        <p className="fine tone-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Mounted once; shows the popover whenever a human-only action needs the approver. */
export function SignInPopover() {
  const request = useSyncExternalStore(subscribeSignIn, currentSignIn, () => null);
  return request ? <Form key={`${request.anchor.x}-${request.anchor.y}-${request.start}`} request={request} /> : null;
}
