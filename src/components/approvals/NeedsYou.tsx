"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import type { Order } from "@/lib/contracts";
import { isSeeded } from "@/lib/console/format/orders";
import { useUi } from "../shell/ui-context";
import { HistoryNote } from "../ui/HistoryNote";
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
        <p className="empty-frame quiet-empty">
          {ready ? (
            <>
              <Inbox aria-hidden="true" />
              <span>Nothing waits for you. Orders over a limit stop here.</span>
              <Link href="/buyer/mandate" className="text-link strong">
                See your limits
              </Link>
            </>
          ) : (
            "Loading the approvals queue…"
          )}
        </p>
      )}
      {recent.length > 0 ? (
        <div className="recent">
          <h3>
            Recent decisions <span className="recent-meta">net amounts</span>
          </h3>
          <HistoryNote show={recent.some(isSeeded)} />
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
