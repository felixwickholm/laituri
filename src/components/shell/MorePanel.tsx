"use client";

import { Info, KeyRound, LogOut, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { demoOffered, passcodeOffered, roleSession } from "@/lib/console/session";
import { consoleStore, useConsole } from "@/lib/console/store";
import type { SessionRole } from "@/lib/console/types";
import { requestSignIn } from "../session/gate";
import { signInSandboxAgain } from "../session/SandboxSignIn";
import { toast } from "../ui/toast";

interface MorePanelProps {
  role: SessionRole;
  /** Called before an action that opens another layer, so the menu does not sit under it. */
  onLeave?: () => void;
}

/**
 * The quiet things, out of the way: what Laituri is, starting over, and (outside a sandbox) the passcode way in or
 * out. In a sandbox nobody signs in or out: both roles are simply signed in.
 */
export function MorePanel({ role, onLeave }: MorePanelProps) {
  const { session } = useConsole();
  const [resetting, setResetting] = useState(false);
  const sandbox = demoOffered(session);
  const side = roleSession(session, role);

  async function startOver() {
    setResetting(true);
    try {
      await consoleStore.reset();
      await signInSandboxAgain();
      toast("Started over.", "neutral");
    } catch {
      toast("Start over did not reach the server.", "danger");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="demo-panel">
      <section className="demo-section">
        <Link href="/about" className="text-link more-link" onClick={onLeave}>
          <Info aria-hidden="true" />
          About Laituri
        </Link>
        {sandbox ? (
          <button type="button" className="text-link more-link" onClick={() => void startOver()} disabled={resetting}>
            <RotateCcw aria-hidden="true" />
            {resetting ? "Starting over…" : "Start over"}
          </button>
        ) : null}
        {!sandbox && side.signedIn ? (
          <button
            type="button"
            className="text-link more-link"
            onClick={async () => {
              onLeave?.();
              await consoleStore.signOut(role).catch(() => undefined);
              toast("Signed out.", "neutral");
            }}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        ) : null}
        {!sandbox && !side.signedIn && passcodeOffered(session, role) ? (
          <button
            type="button"
            className="text-link more-link"
            onClick={(event) => {
              const anchor = event.currentTarget;
              onLeave?.();
              void requestSignIn(anchor, "passcode", role);
            }}
          >
            <KeyRound aria-hidden="true" />
            Sign in
          </button>
        ) : null}
      </section>

    </div>
  );
}
