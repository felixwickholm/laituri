"use client";

import { KeyRound, LogOut } from "lucide-react";
import { useState } from "react";
import { shortName } from "@/lib/console/format/rules";
import { demoOffered, passcodeOffered, roleSession } from "@/lib/console/session";
import { consoleStore, useConsole } from "@/lib/console/store";
import type { SessionRole } from "@/lib/console/types";
import { toast } from "../ui/toast";
import { requestSignIn } from "./gate";

/** The operator's name as the server gives it carries "(demo access)"; the role line says that instead. */
const OPERATOR_NAME = "Valio Aimo operator";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

interface Who {
  name: string;
  /** What the person does here, shown under the name once signed in. */
  title: string;
  /** What one-click demo access makes you, shown before signing in. */
  demoNote: string;
}

function useWho(role: SessionRole): Who {
  const { session, mandate } = useConsole();
  if (role === "operator") {
    return { name: OPERATOR_NAME, title: "Operator", demoNote: `Signs you in as the ${OPERATOR_NAME}, who can suspend and resume agents.` };
  }
  const approver = shortName(session?.approver?.name ?? mandate?.mandate.approval.approver.name ?? "Maria Lind");
  return { name: approver, title: "Approver", demoNote: `Signs you in as ${approver}, the demo approver.` };
}

/**
 * Who acts for the side you are on: the buyer's approver on the buyer side, the Valio Aimo operator on the
 * wholesaler side. One-click demo access sits next to the passcode sign-in, when the server offers it.
 */
export function SessionControl({ role }: { role: SessionRole }) {
  const { session } = useConsole();
  const [busy, setBusy] = useState(false);
  const who = useWho(role);
  const side = roleSession(session, role);

  if (side.signedIn) {
    return (
      <div className="session" data-signed-in="true">
        <span className="avatar" aria-hidden="true">
          {initials(who.name)}
        </span>
        <span className="session-who">
          <span className="session-name">{who.name}</span>
          <span className="session-role">{side.demo ? "demo access" : who.title}</span>
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Sign out ${who.name}`}
          title="Sign out"
          onClick={async () => {
            await consoleStore.signOut(role).catch(() => undefined);
            toast("Signed out.", "neutral");
          }}
        >
          <LogOut aria-hidden="true" />
        </button>
      </div>
    );
  }

  // Until the server says how one signs in here, offer nothing rather than the wrong way in.
  if (!session) return <div className="session" aria-busy="true" />;

  const demo = demoOffered(session);
  async function signInWithDemo() {
    setBusy(true);
    try {
      await consoleStore.signIn({ demo: true, role });
      toast(`Signed in as ${who.name} with demo access.`);
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
      {passcodeOffered(session, role) ? (
        <button type="button" className="text-link session-passcode" onClick={(event) => void requestSignIn(event.currentTarget, "passcode", role)}>
          <KeyRound aria-hidden="true" />
          Sign in with passcode
        </button>
      ) : demo ? (
        <span className="session-note">{who.demoNote}</span>
      ) : (
        <span className="session-note">Signing in is turned off on this server.</span>
      )}
    </div>
  );
}
