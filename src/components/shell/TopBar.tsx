"use client";

import { CircleHelp, PlugZap, ShieldCheck } from "lucide-react";
import type { ConsoleSession, Health } from "@/lib/console/types";
import { SessionButton } from "../session/SessionButton";
import { useUi } from "./ui-context";
import { Wordmark } from "./Wordmark";

function modeLabel(health: Health | undefined): { long: string; short: string; live: boolean } {
  if (!health) return { long: "Connecting", short: "…", live: false };
  return health.mode === "live"
    ? { long: "Live mock API", short: "Live", live: true }
    : { long: "Recorded data", short: "Recorded", live: false };
}

export function TopBar({ health, session }: { health?: Health; session?: ConsoleSession }) {
  const ui = useUi();
  const mode = modeLabel(health);
  return (
    <header className="topbar">
      <Wordmark />
      <span className="scope">Valio Aimo · agent ordering</span>
      <div className="chips">
        <span className="status-chip optional" data-tone={mode.live ? "live" : undefined}>
          <span className="dot" aria-hidden="true" />
          {mode.long}
        </span>
        <span className="status-chip" title="There is no live order endpoint. Orders are confirmed here and marked simulated.">
          <span className="long">Orders are simulated</span>
          <span className="short">Simulated</span>
        </span>
      </div>
      <nav className="actions" aria-label="Console">
        <button type="button" className="btn btn-quiet" onClick={() => ui.openSheet("mandate")} aria-label="Mandate">
          <ShieldCheck aria-hidden="true" />
          <span className="label">Mandate</span>
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => ui.openSheet("connect")} aria-label="Connect an agent">
          <PlugZap aria-hidden="true" />
          <span className="label">Connect an agent</span>
        </button>
        <button type="button" className="btn btn-quiet" onClick={ui.openGuide} aria-label="Guide">
          <CircleHelp aria-hidden="true" />
          <span className="label">Guide</span>
        </button>
        <SessionButton session={session} />
      </nav>
    </header>
  );
}
