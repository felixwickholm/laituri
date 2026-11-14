"use client";

import { LockKeyhole, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ApiError, WRONG_PASSCODE } from "@/lib/console/api";
import { shortName } from "@/lib/console/format/rules";
import { consoleStore, useConsole } from "@/lib/console/store";
import { useDismiss } from "../ui/useDismiss";
import { currentSignIn, subscribeSignIn, type SignInRequest } from "./gate";

const WIDTH = 300;
const GAP = 8;

function place(anchor: DOMRect): { left: number; top?: number; bottom?: number; origin: string } {
  const left = Math.min(Math.max(16, anchor.right - WIDTH), window.innerWidth - WIDTH - 16);
  const below = anchor.bottom + GAP;
  if (window.innerHeight - below > 220) return { left, top: below, origin: "top right" };
  return { left, bottom: window.innerHeight - anchor.top + GAP, origin: "bottom right" };
}

function Form({ request }: { request: SignInRequest }) {
  const { session, mandate } = useConsole();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cancel = useCallback(() => request.resolve(false), [request]);
  useDismiss(root, true, cancel);
  const mode = session?.mode ?? "open";
  const approver = shortName(session?.approver?.name ?? mandate?.mandate.approval.approver.name ?? "the approver");

  useEffect(() => {
    root.current?.querySelector<HTMLElement>("input, button.btn-primary")?.focus();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await consoleStore.signIn(mode === "passcode" ? passcode : undefined);
      request.resolve(true);
    } catch (failure) {
      setBusy(false);
      setError(failure instanceof ApiError && failure.code === WRONG_PASSCODE ? "That passcode is not correct." : "Sign-in did not reach the server.");
    }
  }

  const spot = place(request.anchor);
  return (
    <div
      ref={root}
      className="popover glass signin"
      role="dialog"
      aria-label="Sign in as approver"
      style={{ position: "fixed", left: spot.left, top: spot.top, bottom: spot.bottom, width: WIDTH, transformOrigin: spot.origin, maxWidth: "none" }}
    >
      <button type="button" className="icon-btn close" onClick={cancel} aria-label="Cancel sign-in">
        <X aria-hidden="true" />
      </button>
      <h3>
        <LockKeyhole width={14} height={14} aria-hidden="true" /> Sign in as approver
      </h3>
      <p>Approvals and mandate changes are signed with the approver key.</p>
      <form onSubmit={submit}>
        {mode === "passcode" ? (
          <>
            <label className="field-label" htmlFor="approver-passcode">
              Passcode
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
          </>
        ) : (
          <>
            <button type="submit" className="btn btn-primary wide" disabled={busy}>
              {busy ? "Signing in…" : `Continue as ${approver}`}
            </button>
            <p className="fine">Demo sign-in. No passcode is set on this server.</p>
          </>
        )}
      </form>
      {error ? <p className="fine tone-danger" role="alert">{error}</p> : null}
      <p className="fine">Agents cannot sign in here.</p>
    </div>
  );
}

/** Mounted once; shows the popover whenever a human-only action needs the approver. */
export function SignInPopover() {
  const request = useSyncExternalStore(subscribeSignIn, currentSignIn, () => null);
  return request ? <Form key={`${request.anchor.x}-${request.anchor.y}`} request={request} /> : null;
}
