"use client";

import { useState } from "react";
import type { Order } from "@/lib/contracts";
import { Pane } from "../shell/Pane";
import { useUi } from "../shell/ui-context";
import { useNow } from "../ui/useNow";
import { ApprovalRow } from "./ApprovalRow";
import { HandledRow } from "./HandledRow";

type Tab = "waiting" | "handled";

export function ApprovalsPane({ orders, visible }: { orders: Order[]; visible: boolean }) {
  const ui = useUi();
  const [tab, setTab] = useState<Tab>("waiting");
  const now = useNow(15_000);
  const waiting = orders.filter((order) => order.status === "pending_approval");
  const handled = orders
    .filter((order) => order.status !== "pending_approval")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <Pane id="approvals" num={2} title="Needs you" sub="What waits for a person" visible={visible}>
      <div className="pane-tabs">
        <div className="segmented" role="group" aria-label="Approvals">
          <button type="button" aria-pressed={tab === "waiting"} onClick={() => setTab("waiting")}>
            Waiting<span className="count mono">{waiting.length}</span>
          </button>
          <button type="button" aria-pressed={tab === "handled"} onClick={() => setTab("handled")}>
            Handled<span className="count mono">{handled.length}</span>
          </button>
        </div>
      </div>
      {tab === "waiting" ? (
        waiting.length === 0 ? (
          <p className="pane-empty">Nothing waits for you. The agent is inside its mandate.</p>
        ) : (
          <ul className="inbox" aria-label="Orders waiting for approval">
            {waiting.map((order) => (
              <ApprovalRow key={order.id} order={order} now={now} onOpen={ui.openOrder} />
            ))}
          </ul>
        )
      ) : handled.length === 0 ? (
        <p className="pane-empty">No decided orders yet.</p>
      ) : (
        <ul className="inbox" aria-label="Decided orders">
          {handled.map((order) => (
            <HandledRow key={order.id} order={order} onOpen={ui.openOrder} />
          ))}
        </ul>
      )}
    </Pane>
  );
}
