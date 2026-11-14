"use client";

import { LockKeyhole, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { signInError } from "@/lib/console/session";
import { consoleStore } from "@/lib/console/store";
import type { SessionRole } from "@/lib/console/types";
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
  passcodeLabel: string;
}

/** What the popover says for each role. Roles, not names. */
const COPY: Record<SessionRole, RoleCopy> = {
  approver: { title: "Purchasing manager", passcodeLabel: "Passcode" },
  operator: { title: "Valio Aimo operator", passcodeLabel: "Passcode" },
};

/** The passcode way in, for the shared workspace and production. In a sandbox nobody is asked: see gate.ts. */
function Form({ request }: { request: SignInRequest }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cancel = useCallback(() => request.resolve(false), [request]);
  useDismiss(root, true, cancel);
  const copy = COPY[request.role];

  useEffect(() => {
    root.current?.querySelector<HTMLElement>("input")?.focus();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!passcode) return;
    setBusy(true);
    setError(null);
    try {
      await consoleStore.signIn({ passcode, role: request.role });
      request.resolve(true);
    } catch (failure) {
      setBusy(false);
      setError(signInError(failure));
    }
  }

  const spot = place(request.anchor);
  return (
    <div
      ref={root}
      className="popover signin glass-strong"
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
      <form className="signin-actions" onSubmit={submit}>
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
      </form>
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
  return request ? <Form key={`${request.anchor.x}-${request.anchor.y}-${request.role}`} request={request} /> : null;
}
