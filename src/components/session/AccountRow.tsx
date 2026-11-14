"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { accountFor } from "@/lib/console/format/workspace";
import { demoOffered, passcodeOffered } from "@/lib/console/session";
import { consoleStore, useConsole } from "@/lib/console/store";
import type { SessionRole } from "@/lib/console/types";
import { ThemeToggle } from "../ui/ThemeToggle";
import { toast } from "../ui/toast";
import { requestSignIn } from "./gate";

/** The approver's name from the session, else from the signed mandate. */
export function useAccount(role: SessionRole) {
  const { session, mandate } = useConsole();
  return accountFor(session, role, session?.approver?.name ?? mandate?.mandate.approval.approver.name ?? "Maria Lind");
}

function SignedOut({ role }: { role: SessionRole }) {
  const { session } = useConsole();
  const [busy, setBusy] = useState(false);

  // Until the server says how one signs in here, offer nothing rather than the wrong way in.
  if (!session) return <span className="account-wait" aria-busy="true" />;

  if (demoOffered(session)) {
    return (
      <button
        type="button"
        className="btn btn-secondary account-demo"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await consoleStore.signIn({ demo: true, role });
          } catch {
            toast("Demo access did not reach the server.", "danger");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing in…" : "Use demo access"}
      </button>
    );
  }
  if (passcodeOffered(session, role)) {
    return (
      <button type="button" className="btn btn-secondary account-demo" onClick={(event) => void requestSignIn(event.currentTarget, "passcode", role)}>
        <KeyRound aria-hidden="true" />
        Sign in
      </button>
    );
  }
  return <span className="account-off">Read-only here</span>;
}

/**
 * Who acts for the side you are on, in one row: initials, name and role, then the theme switch.
 * Signed out, the row is the one way in.
 */
export function AccountRow({ role }: { role: SessionRole }) {
  const account = useAccount(role);
  return (
    <div className="account-row" data-signed-in={account.signedIn}>
      {account.signedIn ? (
        <span className="account-who">
          <span className="avatar" aria-hidden="true">
            {account.initials}
          </span>
          <span className="account-text">
            <span className="account-name">{account.name}</span>
            <span className="account-role">{account.role}</span>
          </span>
        </span>
      ) : (
        <SignedOut role={role} />
      )}
      <ThemeToggle />
    </div>
  );
}
