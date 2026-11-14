"use client";

import { CircleHelp, PlugZap, ShieldCheck } from "lucide-react";
import type { ConsoleSession, Health } from "@/lib/console/types";
import { SessionButton } from "../session/SessionButton";
import { useUi } from "./ui-context";
import { Wordmark } from "./Wordmark";

function modeLabel(health: Health | undefined): { long: string; live: boolean } {
  if (!health) return { long: "Connecting", live: false };
  return health.mode === "live" ? { long: "Live prices", live: true } : { long: "Recorded prices", live: false };
}

export function TopBar({ health, session }: { health?: Health; session?: ConsoleSession }) {
  const ui = useUi();
  const mode = modeLabel(health);
  return (
    <header className="topbar">
      <Wordmark />
      <span className="scope">Valio Aimo · agent ordering</span>
      <div className="chips">
        <span
          className="status-chip"
          data-tone={mode.live ? "live" : undefined}
          title="Prices and stock come from Valio Aimo's API. There is no order endpoint, so orders are confirmed here and marked simulated."
        >
          <span className="dot" aria-hidden="true" />
          <span className="long">{mode.long} · simulated orders</span>
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
