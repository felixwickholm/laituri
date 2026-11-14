"use client";

import { LockKeyhole, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { shortName } from "@/lib/console/format/rules";
import { demoOffered, passcodeOffered, signInError } from "@/lib/console/session";
import { consoleStore, useConsole } from "@/lib/console/store";
import type { SessionRole, SignInCredentials } from "@/lib/console/types";
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

interface RoleCopy {
  title: string;
  lede: string;
  demoNote: string;
  passcodeLabel: string;
}

/** What the popover says for each role, given the approver's name. */
function copyFor(role: SessionRole, approver: string): RoleCopy {
  if (role === "operator") {
    return {
      title: "Only a Valio Aimo operator can do this",
      lede: "Suspending or resuming an agent is signed as the Valio Aimo operator and written to the log.",
      demoNote: "Demo access signs you in as the Valio Aimo operator, in your own copy of the demo. Every change is still signed and logged.",
      passcodeLabel: "Operator passcode",
    };
  }
  return {
    title: "Only the approver can do this",
    lede: `Approvals and mandate changes are signed with ${approver}’s approver key and written to the log.`,
    demoNote: `Demo access signs you in as ${approver}, the demo approver. Every decision is still signed and logged.`,
    passcodeLabel: "Approver passcode",
  };
}

function Form({ request }: { request: SignInRequest }) {
  const { session, mandate } = useConsole();
  const demo = demoOffered(session);
  const passcodeWay = passcodeOffered(session, request.role);
  const [passcodeMode, setPasscodeMode] = useState(request.start === "passcode" || !demo);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cancel = useCallback(() => request.resolve(false), [request]);
  useDismiss(root, true, cancel);
  const approver = shortName(session?.approver?.name ?? mandate?.mandate.approval.approver.name ?? "the approver");
  const copy = copyFor(request.role, approver);

  useEffect(() => {
    root.current?.querySelector<HTMLElement>("input, .btn-primary")?.focus();
  }, [passcodeMode]);

  async function signIn(credentials: SignInCredentials) {
    setBusy(true);
    setError(null);
    try {
      await consoleStore.signIn({ ...credentials, role: request.role });
      request.resolve(true);
    } catch (failure) {
      setBusy(false);
      setError(signInError(failure));
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
        {copy.title}
      </h3>
      <p>{copy.lede}</p>
      {demo && !passcodeMode ? (
        <div className="signin-actions">
          <button type="button" className="btn btn-primary wide" disabled={busy} onClick={() => signIn({ demo: true })}>
            {busy ? "Signing in…" : "Continue with demo access"}
          </button>
          <p className="fine">{copy.demoNote}</p>
          {passcodeWay ? (
            <button type="button" className="text-link" onClick={() => setPasscodeMode(true)}>
              Use the passcode instead
            </button>
          ) : null}
        </div>
      ) : (
        <form className="signin-actions" onSubmit={submitPasscode}>
          <label className="field-label" htmlFor="signin-passcode">
            {copy.passcodeLabel}
          </label>
          <input
            id="signin-passcode"
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
