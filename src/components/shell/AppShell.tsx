"use client";

import { CirclePlay, Ellipsis } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { buyerOrders } from "@/lib/console/format/orders";
import { sharedLocked } from "@/lib/console/format/workspace";
import { useBaskets } from "@/lib/console/basket-store";
import { useConsole } from "@/lib/console/store";
import { useWorkspace } from "@/lib/console/workspace-store";
import { OrderSheet } from "../order/OrderSheet";
import { SignInPopover } from "../session/SignInPopover";
import { SharedLock } from "../session/SharedLock";
import { SharedViewBanner } from "../session/WorkspaceIndicator";
import { Sheet } from "../ui/Sheet";
import { Tour } from "../tour/Tour";
import { CartChip } from "./CartChip";
import { TourLink } from "../tour/TourLink";
import { Toaster } from "../ui/toast";
import { useHandoffs } from "./feed";
import { NAV, type Side } from "./nav";
import { NavLinks } from "./NavLinks";
import { ShellTools } from "./ShellTools";
import { SideSwitch } from "./SideSwitch";
import { needsYou, openQuestions, type NavSignals } from "./signals";
import { UiContext, type ConsoleUi } from "./ui-context";
import { BrandHeader } from "./Wordmark";

export type { Side };

export interface AppShellProps {
  side: Side;
  children: ReactNode;
}

/**
 * The frame both sides share: a sidebar on desktop, a top bar and a tab bar on phones.
 * It holds the one console subscription, the order sheet and the sign-in popover.
 */
export function AppShell({ side, children }: AppShellProps) {
  const snapshot = useConsole();
  const locked = sharedLocked(useWorkspace(), snapshot.session);
  const { baskets } = useBaskets();
  const handoffs = useHandoffs(side === "valio");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const ui = useMemo<ConsoleUi>(() => ({ openOrder: setOrderId }), []);
  const closeOrder = useCallback(() => setOrderId(null), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  const signals: NavSignals = {
    needsYou: needsYou(baskets, buyerOrders(snapshot.orders, snapshot.mandate)),
    questions: openQuestions(handoffs),
    recordBroken: snapshot.chain.state === "broken",
  };
  const items = NAV[side];
  const root = items[0].href;
  const label = side === "buyer" ? "Customer" : "Valio Aimo";

  return (
    <UiContext.Provider value={ui}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="shell" data-side={side}>
        <aside className="sidebar" aria-label="Laituri">
          <Link href="/" className="brand" aria-label="Laituri for Valio Aimo, home">
            <BrandHeader layout="stack" logoHeight={48} />
          </Link>
          <SideSwitch side={side} />
          <TourLink className="side-tour">
            <CirclePlay aria-hidden="true" />
            <span>Demo walkthrough</span>
          </TourLink>
          <nav className="side-nav" aria-label={label}>
            <NavLinks items={items} root={root} signals={signals} variant="list" />
          </nav>
          <ShellTools side={side} signals={signals} variant="sidebar" />
        </aside>

        <header className="phone-bar">
          <Link href="/" className="brand" aria-label="Laituri for Valio Aimo, home">
            <BrandHeader layout="bar" logoHeight={40} />
          </Link>
          <SideSwitch side={side} />
        </header>

        <div className="shell-main">
          <div className="shell-top">
            <TourLink className="btn btn-primary shell-tour">
              <CirclePlay aria-hidden="true" />
              Demo walkthrough
            </TourLink>
            {side === "buyer" ? <CartChip /> : null}
          </div>
          <main className="canvas" id="main" tabIndex={-1}>
            {locked ? (
              <SharedLock role={side === "buyer" ? "approver" : "operator"} />
            ) : (
              <>
                <SharedViewBanner />
                {children}
              </>
            )}
          </main>
        </div>

        <nav className="tab-bar" aria-label={label}>
          <div className="phone-dock" data-tour-dock="phone" />
          <NavLinks items={items.filter((item) => item.tab)} root={root} signals={signals} variant="tabs" />
          <button type="button" className="nav-item" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
            <Ellipsis aria-hidden="true" />
            <span className="nav-label">More</span>
          </button>
        </nav>
      </div>

      <Sheet open={moreOpen} onClose={closeMore} title="More">
        <ShellTools side={side} signals={signals} variant="sheet" />
      </Sheet>
      <OrderSheet orderId={orderId} onClose={closeOrder} />
      <SignInPopover />
      <Toaster />
      <Tour />
    </UiContext.Provider>
  );
}
