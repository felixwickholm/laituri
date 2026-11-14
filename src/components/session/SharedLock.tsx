"use client";

import { KeyRound, Lock } from "lucide-react";
import type { SessionRole } from "@/lib/console/types";
import { requestSignIn } from "./gate";
import { useViewSwitch } from "./WorkspaceIndicator";

/** The shared workspace without a passcode session: one calm state with the two ways on, in place of the page. */
export function SharedLock({ role }: { role: SessionRole }) {
  const { busy, switchTo } = useViewSwitch();
  return (
    <section className="shared-lock" role="status" aria-labelledby="shared-lock-title">
      <Lock className="shared-lock-icon" aria-hidden="true" />
      <h1 id="shared-lock-title">The shared workspace is read with a passcode</h1>
      <p>Sign in, or go back to your own workspace.</p>
      <div className="shared-lock-actions">
        <button type="button" className="btn btn-primary" onClick={(event) => void requestSignIn(event.currentTarget, "passcode", role)}>
          <KeyRound aria-hidden="true" />
          Sign in with passcode
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void switchTo("sandbox")}>
          Back to my workspace
        </button>
      </div>
    </section>
  );
}
