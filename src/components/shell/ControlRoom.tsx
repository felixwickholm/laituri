"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { guideSeen } from "@/lib/console/guide";
import { useConsole } from "@/lib/console/store";
import { AgentPane } from "../agent/AgentPane";
import { ApprovalsPane } from "../approvals/ApprovalsPane";
import { ConnectSheet } from "../connect/ConnectSheet";
import { Guide } from "../guide/Guide";
import { MandateSheet } from "../mandate/MandateSheet";
import { OrderSheet } from "../order/OrderSheet";
import { ProofPane } from "../proof/ProofPane";
import { SignInPopover } from "../session/SignInPopover";
import { Toaster } from "../ui/toast";
import { Dock } from "./Dock";
import { PaneSwitch, type PaneId } from "./PaneSwitch";
import { TopBar } from "./TopBar";
import { UiContext, type ConsoleUi, type SheetName } from "./ui-context";

/** The one screen: agent, approvals and proof side by side, with the dock and sheets floating above. */
export function ControlRoom() {
  const snapshot = useConsole();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [guide, setGuide] = useState(false);
  const [pane, setPane] = useState<PaneId>("agent");

  useEffect(() => {
    if (guideSeen()) return;
    const timer = setTimeout(() => setGuide(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const ui = useMemo<ConsoleUi>(
    () => ({
      openOrder: (id) => {
        setSheet(null);
        setOrderId(id);
      },
      openSheet: (name) => {
        setOrderId(null);
        setSheet(name);
      },
      openGuide: () => setGuide(true),
    }),
    [],
  );

  const closeOrder = useCallback(() => setOrderId(null), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeGuide = useCallback(() => setGuide(false), []);
  const followGuide = useCallback((target: string) => {
    if (target === "agent" || target === "approvals" || target === "proof") setPane(target);
  }, []);

  const pending = snapshot.orders.filter((order) => order.status === "pending_approval").length;
  const fresh = snapshot.ready && snapshot.activity.length === 0 && snapshot.audit.length === 0 && !snapshot.run;

  return (
    <UiContext.Provider value={ui}>
      <div className="room">
        <TopBar health={snapshot.health} session={snapshot.session} />
        <PaneSwitch
          value={pane}
          onChange={setPane}
          counts={{ agent: snapshot.activity.length, approvals: pending, proof: snapshot.audit.length }}
          broken={snapshot.chain.state === "broken"}
        />
        <main className="panes">
          <AgentPane activity={snapshot.activity} run={snapshot.run} online={snapshot.online} visible={pane === "agent"} />
          <ApprovalsPane orders={snapshot.orders} visible={pane === "approvals"} />
          <ProofPane audit={snapshot.audit} chain={snapshot.chain} visible={pane === "proof"} />
        </main>
      </div>
      <Dock run={snapshot.run} fresh={fresh} />
      <OrderSheet orderId={orderId} onClose={closeOrder} />
      <MandateSheet open={sheet === "mandate"} onClose={closeSheet} />
      <ConnectSheet open={sheet === "connect"} onClose={closeSheet} />
      <Guide open={guide} onClose={closeGuide} onStep={followGuide} />
      <SignInPopover />
      <Toaster />
    </UiContext.Provider>
  );
}
