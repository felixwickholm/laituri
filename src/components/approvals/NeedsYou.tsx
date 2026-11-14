"use client";

import type { Order } from "@/lib/contracts";
import { useUi } from "../shell/ui-context";
import { useNow } from "../ui/useNow";
import { ApprovalRow } from "./ApprovalRow";
import { HandledRow } from "./HandledRow";

const RECENT = 3;

interface NeedsYouProps {
  orders: Order[];
  /** True while the log does not verify; the server refuses approvals then. */
  paused: boolean;
  ready: boolean;
  /** Also lists the last few decisions; off where the queue leads the page and must stay short. */
  recent?: boolean;
}

/** The approvals queue, then the last few decisions so an empty queue still shows what happened. */
export function NeedsYou({ orders, paused, ready, recent: withRecent = true }: NeedsYouProps) {
  const ui = useUi();
  const now = useNow(15_000);
  const waiting = orders.filter((order) => order.status === "pending_approval");
  const recent = (withRecent ? orders : [])
    .filter((order) => order.status !== "pending_approval")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT);

  return (
    <section className="block" id="needs-you" aria-labelledby="needs-title" data-waiting={waiting.length > 0}>
      <header className="block-head">
        <h2 id="needs-title">
          Needs you <span className="count">{waiting.length}</span>
        </h2>
      </header>
      {waiting.length > 0 ? (
        <ul className="inbox" aria-label="Orders waiting for approval">
          {waiting.map((order) => (
            <ApprovalRow key={order.id} order={order} now={now} paused={paused} onOpen={ui.openOrder} />
          ))}
        </ul>
      ) : (
        <p className="empty-frame">
          {ready ? "Nothing waits for you. Orders over a limit stop here for your decision." : "Loading the approvals queue…"}
        </p>
      )}
      {recent.length > 0 ? (
        <div className="recent">
          <h3>Recent decisions</h3>
          <ul className="handled-list">
            {recent.map((order) => (
              <HandledRow key={order.id} order={order} onOpen={ui.openOrder} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
