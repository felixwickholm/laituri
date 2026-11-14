"use client";

import { KeyRound } from "lucide-react";
import { accountFor } from "@/lib/console/format/workspace";
import { demoOffered, passcodeOffered } from "@/lib/console/session";
import { useConsole } from "@/lib/console/store";
import type { SessionRole } from "@/lib/console/types";
import { ThemeToggle } from "../ui/ThemeToggle";
import { requestSignIn } from "./gate";

/** The approver's name from the session, else from the signed mandate. */
export function useAccount(role: SessionRole) {
  const { session, mandate } = useConsole();
  return accountFor(session, role, session?.approver?.name ?? mandate?.mandate.approval.approver.name ?? "Maria Lind");
}

/** The role is the whole account line: who acts on this side. */
export const ROLE_TITLE: Record<SessionRole, string> = { approver: "Purchasing manager", operator: "Valio Aimo operator" };

function SignedOut({ role }: { role: SessionRole }) {
  const { session } = useConsole();
  // Until the server says how one signs in here, offer nothing rather than the wrong way in.
  if (!session) return <span className="account-wait" aria-busy="true" />;
  // A sandbox signs itself in a moment after load (SandboxSignIn): the role already stands there.
  if (demoOffered(session)) return <RoleName role={role} />;
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

function RoleName({ role }: { role: SessionRole }) {
  return (
    <span className="account-who">
      <span className="account-name">{ROLE_TITLE[role]}</span>
    </span>
  );
}

/** Who acts for the side you are on, by role only, then the theme switch. Signed out elsewhere, the row is the way in. */
export function AccountRow({ role }: { role: SessionRole }) {
  const account = useAccount(role);
  return (
    <div className="account-row" data-signed-in={account.signedIn}>
      {account.signedIn ? (
        <RoleName role={role} />
      ) : (
        <SignedOut role={role} />
      )}
      <ThemeToggle />
    </div>
  );
}
