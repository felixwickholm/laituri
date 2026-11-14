"use client";

import { KeyRound, LogOut } from "lucide-react";
import { useState } from "react";
import { shortName } from "@/lib/console/format/rules";
import { demoOffered, isDemoSession } from "@/lib/console/session";
import { consoleStore, useConsole } from "@/lib/console/store";
import { toast } from "../ui/toast";
import { requestSignIn } from "./gate";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Who signs approvals in this browser, with one-click demo access next to the passcode sign-in. */
export function SessionControl() {
  const { session, mandate } = useConsole();
  const [busy, setBusy] = useState(false);
  const approver = shortName(session?.approver?.name ?? mandate?.mandate.approval.approver.name ?? "Maria Lind");

  if (session?.signedIn) {
    return (
      <div className="session" data-signed-in="true">
        <span className="avatar" aria-hidden="true">
          {initials(approver)}
        </span>
        <span className="session-who">
          <span className="session-name">{approver}</span>
          <span className="session-role">{isDemoSession(session) ? "demo access" : "Approver"}</span>
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Sign out ${approver}`}
          title="Sign out"
          onClick={async () => {
            await consoleStore.signOut().catch(() => undefined);
            toast("Signed out.", "neutral");
          }}
        >
          <LogOut aria-hidden="true" />
        </button>
      </div>
    );
  }

  const demo = demoOffered(session);
  async function signInWithDemo() {
    setBusy(true);
    try {
      await consoleStore.signIn({ demo: true });
      toast(`Signed in as ${approver} with demo access.`);
    } catch {
      toast("Demo access did not reach the server.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="session">
      {demo ? (
        <button type="button" className="btn btn-secondary session-demo" onClick={signInWithDemo} disabled={busy}>
          {busy ? "Signing in…" : "Use demo access"}
        </button>
      ) : null}
      {session?.mode === "passcode" || !demo ? (
        <button type="button" className="text-link session-passcode" onClick={(event) => void requestSignIn(event.currentTarget, "passcode")}>
          <KeyRound aria-hidden="true" />
          Sign in with passcode
        </button>
      ) : (
        <span className="session-note">Signs you in as {approver}, the demo approver.</span>
      )}
    </div>
  );
}
