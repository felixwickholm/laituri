"use client";

import { Eye, KeyRound, Lock, LogOut, RotateCcw } from "lucide-react";
import { useState } from "react";
import { demoFacts, engineChip, workspaceLine } from "@/lib/console/format/workspace";
import { passcodeOffered, roleSession } from "@/lib/console/session";
import { consoleStore, useConsole } from "@/lib/console/store";
import type { SessionRole } from "@/lib/console/types";
import { useWorkspace } from "@/lib/console/workspace-store";
import { requestSignIn } from "../session/gate";
import { useViewSwitch } from "../session/WorkspaceIndicator";
import { TechDetails } from "../ui/TechDetails";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";

interface DemoPanelProps {
  role: SessionRole;
  /** Called before an action that opens another layer, so the menu does not sit under it. */
  onLeave?: () => void;
}

/**
 * Everything about the demo itself, kept out of the way: this browser's workspace and its time left, the shared view,
 * reset, what is live and what is simulated, the engine, and the other ways to sign in or out.
 */
export function DemoPanel({ role, onLeave }: DemoPanelProps) {
  const { session, health } = useConsole();
  const info = useWorkspace();
  const now = useNow(30_000);
  const { busy: switching, switchTo } = useViewSwitch();
  const [resetting, setResetting] = useState(false);
  const line = info ? workspaceLine(info, now) : undefined;
  const engine = engineChip(health);
  const side = roleSession(session, role);

  async function reset() {
    setResetting(true);
    try {
      await consoleStore.reset();
      toast("Your demo is back to its start. Nobody else’s copy changed.", "neutral");
    } catch {
      toast("Reset did not reach the server.", "danger");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="demo-panel">
      <section className="demo-section" aria-label="Your workspace">
        {line ? (
          <p className="demo-ws" data-shared={line.shared}>
            {line.shared ? <Eye aria-hidden="true" /> : <Lock aria-hidden="true" />}
            <span>
              <strong>{line.label}</strong>
              <span>{[line.privacy, line.timeLeft].filter(Boolean).join(" · ")}</span>
            </span>
          </p>
        ) : (
          <p className="demo-ws">Finding your workspace…</p>
        )}
        <div className="demo-actions">
          {line && !line.shared ? (
            <button type="button" className="btn btn-secondary" onClick={() => void reset()} disabled={resetting}>
              <RotateCcw aria-hidden="true" />
              {resetting ? "Resetting…" : "Reset my demo"}
            </button>
          ) : null}
          {line ? (
            <button type="button" className="btn btn-quiet" disabled={switching} onClick={() => void switchTo(line.shared ? "sandbox" : "shared")}>
              {line.shared ? "Back to my workspace" : "View the shared workspace"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="demo-section" aria-labelledby="demo-live-title">
        <h3 id="demo-live-title" className="demo-title">
          What is live and what is simulated
        </h3>
        <dl className="demo-facts">
          {demoFacts(health?.mode).map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        {engine ? (
          <div className="demo-engine">
            <span className="state">{engine.label}</span>
            <TechDetails rows={[{ label: "Model", value: engine.model, mono: true }]} />
          </div>
        ) : null}
      </section>

      {side.signedIn || passcodeOffered(session, role) || side.mode === "passcode" ? (
        <section className="demo-section demo-signin">
          {side.signedIn ? (
            <button
              type="button"
              className="text-link quiet"
              onClick={async () => {
                onLeave?.();
                await consoleStore.signOut(role).catch(() => undefined);
                toast("Signed out.", "neutral");
              }}
            >
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              className="text-link"
              onClick={(event) => {
                const anchor = event.currentTarget;
                onLeave?.();
                void requestSignIn(anchor, "passcode", role);
              }}
            >
              <KeyRound aria-hidden="true" />
              Sign in with the passcode
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
