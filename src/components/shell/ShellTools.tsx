import Link from "next/link";
import { CirclePlay, PlugZap } from "lucide-react";
import type { SessionRole } from "@/lib/console/types";
import { AccountRow } from "../session/AccountRow";
import { TourLink } from "../tour/TourLink";
import type { Side } from "./nav";
import { DemoMenu } from "./DemoMenu";
import { DemoPanel } from "./DemoPanel";

function roleOf(side: Side): SessionRole {
  return side === "buyer" ? "approver" : "operator";
}

function ExtraLinks() {
  return (
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
    </ul>
  );
}

/**
 * The foot of the sidebar: two more links, the slot the paused tour docks into, the quiet demo menu and the account
 * row. In the phone's More sheet the demo menu is laid out in full instead.
 */
export function ShellTools({ side, variant }: { side: Side; variant: "sidebar" | "sheet" }) {
  const role = roleOf(side);
  if (variant === "sheet") {
    return (
      <div className="shell-tools" data-variant="sheet">
        <ExtraLinks />
        <AccountRow role={role} />
        <DemoPanel role={role} />
      </div>
    );
  }
  return (
    <div className="shell-tools" data-variant="sidebar">
      <ExtraLinks />
      <div data-tour-dock="side" />
      <DemoMenu role={role} />
      <AccountRow role={role} />
    </div>
  );
}
