import { CirclePlay } from "lucide-react";
import type { ReactNode } from "react";
import type { SessionRole } from "@/lib/console/types";
import { AccountRow } from "../session/AccountRow";
import { TourLink } from "../tour/TourLink";
import { MoreMenu } from "./MoreMenu";
import { MorePanel } from "./MorePanel";
import { NAV, SHARED, type Side } from "./nav";
import { NavLinks } from "./NavLinks";
import type { NavSignals } from "./signals";

function roleOf(side: Side): SessionRole {
  return side === "buyer" ? "approver" : "operator";
}

/** Security, Connect an agent and the walkthrough: the same on both sides. */
function SharedLinks({ side, signals, children }: { side: Side; signals: NavSignals; children?: ReactNode }) {
  return (
    <nav className="shared-nav" aria-label="Both sides">
      <TourLink className="nav-item nav-tour">
        <CirclePlay aria-hidden="true" />
        <span className="nav-label">Demo walkthrough</span>
      </TourLink>
      <NavLinks items={SHARED} root={NAV[side][0].href} signals={signals} variant="list" />
      {children}
    </nav>
  );
}

/**
 * The foot of the sidebar: the walkthrough, the shared links, the quiet More menu, the slot the paused tour docks into
 * and the account row. In the phone's More sheet: the side's places that have no tab, the shared links, the account
 * and the More panel laid out in full.
 */
export function ShellTools({ side, signals, variant }: { side: Side; signals: NavSignals; variant: "sidebar" | "sheet" }) {
  const role = roleOf(side);
  if (variant === "sheet") {
    const rest = NAV[side].filter((item) => !item.tab);
    return (
      <div className="shell-tools" data-variant="sheet">
        <nav aria-label="More places">
          <NavLinks items={rest} root={NAV[side][0].href} signals={signals} variant="list" />
        </nav>
        <SharedLinks side={side} signals={signals} />
        <AccountRow role={role} />
        <MorePanel role={role} />
      </div>
    );
  }
  return (
    <div className="shell-tools" data-variant="sidebar">
      <SharedLinks side={side} signals={signals}>
        <MoreMenu role={role} />
      </SharedLinks>
      <div data-tour-dock="side" />
      <AccountRow role={role} />
    </div>
  );
}
