"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { buyerOrders } from "@/lib/console/format/orders";
import { useConsole } from "@/lib/console/store";
import { OrderSheet } from "../order/OrderSheet";
import { SignInPopover } from "../session/SignInPopover";
import { Sheet } from "../ui/Sheet";
import { Tour } from "../tour/Tour";
import { Toaster } from "../ui/toast";
import type { Side } from "./nav";
import { NavLinks, type NavSignals } from "./NavLinks";
import { ShellTools } from "./ShellTools";
import { SideSwitch } from "./SideSwitch";
import { UiContext, type ConsoleUi } from "./ui-context";
import { Wordmark } from "./Wordmark";

export type { Side };

export interface AppShellProps {
  side: Side;
  children: ReactNode;
}

const FALLBACK_BUYER = "Nordic Harbour Hotels";

/**
 * The frame both sides share: a sidebar on desktop, a top bar and a tab bar on phones.
 * It holds the one console subscription, the order sheet and the sign-in popover.
 */
export function AppShell({ side, children }: AppShellProps) {
  const snapshot = useConsole();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const ui = useMemo<ConsoleUi>(() => ({ openOrder: setOrderId }), []);
  const closeOrder = useCallback(() => setOrderId(null), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  const buyer = snapshot.mandate?.mandate.buyer.name ?? FALLBACK_BUYER;
  const sideName = side === "buyer" ? `Your kitchen’s agent · ${buyer}` : "Valio Aimo control";
  const signals: NavSignals = {
    waiting: buyerOrders(snapshot.orders, snapshot.mandate).filter((order) => order.status === "pending_approval").length,
    chainBroken: snapshot.chain.state === "broken",
  };

  return (
    <UiContext.Provider value={ui}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="shell" data-side={side}>
        <aside className="sidebar" aria-label="Laituri">
          <Link href="/" className="brand" aria-label="Laituri home">
            <Wordmark />
          </Link>
          <SideSwitch side={side} />
          <p className="side-name">{sideName}</p>
          <nav className="side-nav" aria-label={side === "buyer" ? "Buyer" : "Valio Aimo"}>
            <NavLinks side={side} signals={signals} variant="list" />
          </nav>
          <ShellTools health={snapshot.health} />
        </aside>

        <header className="phone-bar">
          <Link href="/" className="brand" aria-label="Laituri home">
            <Wordmark />
          </Link>
          <SideSwitch side={side} />
        </header>

        <main className="canvas" id="main" tabIndex={-1}>
          {children}
        </main>

        <nav className="tab-bar" aria-label={side === "buyer" ? "Buyer" : "Valio Aimo"}>
          <NavLinks side={side} signals={signals} variant="tabs" />
          <button type="button" className="nav-item" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
            <Ellipsis aria-hidden="true" />
            <span className="nav-label">More</span>
          </button>
        </nav>
      </div>

      <Sheet open={moreOpen} onClose={closeMore} title="More" lede={sideName}>
        <ShellTools health={snapshot.health} />
      </Sheet>
      <OrderSheet orderId={orderId} onClose={closeOrder} />
      <SignInPopover />
      <Toaster />
      <Tour />
    </UiContext.Provider>
  );
}
