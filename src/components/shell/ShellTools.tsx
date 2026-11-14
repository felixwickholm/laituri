import Link from "next/link";
import { CirclePlay, PlugZap } from "lucide-react";
import type { Health } from "@/lib/console/types";
import { SessionControl } from "../session/SessionControl";
import { WorkspaceIndicator } from "../session/WorkspaceIndicator";
import { TourLink } from "../tour/TourLink";
import { ThemeToggle } from "../ui/ThemeToggle";
import type { Side } from "./nav";
import { ResetButton } from "./ResetButton";

function honestStatus(health: Health | undefined): string {
  const prices = health?.mode === "recorded" ? "Recorded prices" : "Live prices";
  return `${prices} · simulated orders · demo data`;
}

/**
 * What both sides share: connecting an agent, the tour, reset, who acts for this side, the theme, which workspace
 * this is and what is real.
 */
export function ShellTools({ health, side }: { health?: Health; side: Side }) {
  return (
    <div className="shell-tools">
      <ul className="nav-list">
        <li>
          <Link href="/connect" className="nav-item">
            <PlugZap aria-hidden="true" />
            <span className="nav-label">Connect an agent</span>
          </Link>
        </li>
        <li>
          <TourLink className="nav-item">
            <CirclePlay aria-hidden="true" />
            <span className="nav-label">See it in 2 minutes</span>
          </TourLink>
        </li>
        <li>
          <ResetButton />
        </li>
      </ul>
      <div className="session-row">
        <SessionControl role={side === "buyer" ? "approver" : "operator"} />
        <ThemeToggle />
      </div>
      <WorkspaceIndicator />
      <p className="honest-status" title="Prices and stock come from Valio Aimo. There is no order endpoint, so orders are confirmed here and marked simulated.">
        <span className="dot" data-live={health?.mode !== "recorded"} aria-hidden="true" />
        {honestStatus(health)}
      </p>
    </div>
  );
}
