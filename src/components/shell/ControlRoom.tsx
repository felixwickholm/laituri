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
import type { Feed } from "./Pane";
import { PaneSwitch, type PaneId } from "./PaneSwitch";
import { TopBar } from "./TopBar";
import { buildRuns } from "@/lib/console/runs";

/** What this is, in one breath, for someone who has ten seconds. */
const PRODUCT_SENTENCE = "An AI agent buys from Valio Aimo within limits you signed. Past a limit, you decide. Every step is signed and checkable.";
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

  const runCount = useMemo(() => buildRuns(snapshot.activity).length, [snapshot.activity]);
  const feed: Feed = !snapshot.ready ? "loading" : snapshot.online ? "ok" : "offline";
  const pending = snapshot.orders.filter((order) => order.status === "pending_approval").length;
  const fresh = snapshot.ready && snapshot.activity.length === 0 && snapshot.audit.length === 0 && !snapshot.run;

  return (
    <UiContext.Provider value={ui}>
      <div className="room">
        <div className="chrome glass">
          <TopBar health={snapshot.health} session={snapshot.session} />
          <PaneSwitch value={pane} onChange={setPane} counts={{ agent: runCount, approvals: pending, proof: snapshot.audit.length }} broken={snapshot.chain.state === "broken"} />
        </div>
        <div className="intro-wrap" data-open={fresh || !snapshot.ready} aria-hidden={!(fresh || !snapshot.ready)}>
          <div className="intro">
            <p>{PRODUCT_SENTENCE}</p>
          </div>
        </div>
        <main className="panes" data-under-chrome={!fresh && snapshot.ready}>
          <AgentPane
            activity={snapshot.activity}
            orders={snapshot.orders}
            run={snapshot.run}
            approver={snapshot.mandate?.mandate.approval.approver.name}
            feed={feed}
            visible={pane === "agent"}
          />
          <ApprovalsPane orders={snapshot.orders} feed={feed} visible={pane === "approvals"} />
          <ProofPane audit={snapshot.audit} chain={snapshot.chain} orders={snapshot.orders} jwks={snapshot.jwks} mandate={snapshot.mandate} feed={feed} visible={pane === "proof"} />
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
