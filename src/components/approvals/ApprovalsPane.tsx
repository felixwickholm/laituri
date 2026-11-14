"use client";

import { useState } from "react";
import type { Order } from "@/lib/contracts";
import { EmptyLine, Pane, type Feed } from "../shell/Pane";
import { useUi } from "../shell/ui-context";
import { useNow } from "../ui/useNow";
import { ApprovalRow } from "./ApprovalRow";
import { HandledRow } from "./HandledRow";

type Tab = "waiting" | "handled";
const RECENT = 3;

export function ApprovalsPane({ orders, feed, visible }: { orders: Order[]; feed: Feed; visible: boolean }) {
  const ui = useUi();
  const [tab, setTab] = useState<Tab>("waiting");
  const now = useNow(15_000);
  const waiting = orders.filter((order) => order.status === "pending_approval");
  const handled = orders
    .filter((order) => order.status !== "pending_approval")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recent = handled.slice(0, RECENT);

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
        <>
          {waiting.length === 0 ? (
            feed === "ok" ? (
              <p className="pane-empty quiet">
                <strong>Nothing waits for you.</strong> The agent is inside its mandate.
              </p>
            ) : (
              <EmptyLine feed={feed}>{null}</EmptyLine>
            )
          ) : (
            <ul className="inbox" aria-label="Orders waiting for approval">
              {waiting.map((order) => (
                <ApprovalRow key={order.id} order={order} now={now} onOpen={ui.openOrder} />
              ))}
            </ul>
          )}
          {recent.length > 0 ? (
            <section className="recent" aria-label="Recent decisions">
              <h3>Recent decisions</h3>
              <ul className="inbox">
                {recent.map((order) => (
                  <HandledRow key={order.id} order={order} onOpen={ui.openOrder} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : handled.length === 0 ? (
        <EmptyLine feed={feed}>No decided orders yet.</EmptyLine>
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
