"use client";

import { useMemo, useState } from "react";
import { count, eur } from "@/lib/console/format/money";
import { buyerOrders, isSeeded, newestFirst, orderOutcome, OUTCOME_FILTERS, weekStats, type OutcomeKey } from "@/lib/console/format/orders";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { useConsole } from "@/lib/console/store";
import { PageHeader } from "../shell/PageHeader";
import { useUi } from "../shell/ui-context";
import { useNow } from "../ui/useNow";
import { OrdersTable } from "../order/OrdersTable";
import { HistoryNote } from "../ui/HistoryNote";

type Filter = OutcomeKey | "all";

/** Every order the agent placed for this buyer, filterable by how it ended. */
export function OrdersScreen() {
  const snapshot = useConsole();
  const ui = useUi();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Filter>("all");
  const orders = useMemo(() => newestFirst(buyerOrders(snapshot.orders, snapshot.mandate)), [snapshot.orders, snapshot.mandate]);
  const counts = useMemo(() => {
    const tally: Record<OutcomeKey, number> = { auto: 0, approved: 0, waiting: 0, rejected: 0, blocked: 0, refused: 0 };
    for (const order of orders) tally[orderOutcome(order).key] += 1;
    return tally;
  }, [orders]);
  const shown = filter === "all" ? orders : orders.filter((order) => orderOutcome(order).key === filter);
  const week = weekStats(orders, now);

  return (
    <div className="page">
      <PageHeader
        title="Orders"
        meta={`${count(orders.length)} ${orders.length === 1 ? "order" : "orders"}`}
        lede={
          snapshot.locked
            ? LOCKED_NOTE
            : snapshot.ready
            ? `${eur(week.spent)} net confirmed this week. ${counts.waiting > 0 ? `${counts.waiting} ${counts.waiting === 1 ? "waits" : "wait"} for you.` : "Nothing waits for you."}`
            : "Loading orders…"
        }
      />
      <div className="filter-row chip-scroll" role="group" aria-label="Filter by outcome">
        <button type="button" className="filter-chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="count">{orders.length}</span>
        </button>
        {OUTCOME_FILTERS.map((item) => (
          <button key={item.key} type="button" className="filter-chip" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
            {item.label} <span className="count">{counts[item.key]}</span>
          </button>
        ))}
      </div>
      <div className="log-list">
        <HistoryNote show={shown.some(isSeeded)} />
        <OrdersTable orders={shown} ready={snapshot.ready} filtered={filter !== "all"} onOpen={ui.openOrder} />
      </div>
    </div>
  );
}
