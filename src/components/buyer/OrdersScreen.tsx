"use client";

import { PackageOpen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useBaskets } from "@/lib/console/basket-store";
import { historyItems, lightCounts, matchesLight, type Light } from "@/lib/console/history";
import { count } from "@/lib/console/format/money";
import { buyerOrders } from "@/lib/console/format/orders";
import { longDay } from "@/lib/console/format/time";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { useConsole } from "@/lib/console/store";
import { HistoryRows } from "../basket/HistoryRows";
import { PageHeader } from "../shell/PageHeader";
import { useUi } from "../shell/ui-context";
import { useNow } from "../ui/useNow";

type Filter = Light | "all";

/** Baskets and single orders in one list, newest first, filtered by how their lines ended. */
export function OrdersScreen() {
  const snapshot = useConsole();
  const { baskets, ready: basketsReady } = useBaskets();
  const ui = useUi();
  const [filter, setFilter] = useState<Filter>("all");
  const items = useMemo(() => historyItems(baskets, buyerOrders(snapshot.orders, snapshot.mandate)), [baskets, snapshot.orders, snapshot.mandate]);
  const counts = useMemo(() => lightCounts(items), [items]);
  const ready = snapshot.ready && basketsReady;
  const waiting = counts.orange;
  const now = useNow(60_000);

  const tiles: { key: Filter; word: string; value: number; tone?: "success" | "warn" | "danger" }[] = [
    { key: "all", word: items.length === 1 ? "order" : "orders", value: items.length },
    { key: "green", word: "ordered", value: counts.green, tone: "success" },
    { key: "orange", word: "needs you", value: counts.orange, tone: "warn" },
    { key: "red", word: "blocked", value: counts.red + counts.refused, tone: "danger" },
  ];
  const pick = (key: Filter) => setFilter(filter === key && key !== "all" ? "all" : key);
  const matches = (item: (typeof items)[number], key: Filter) => (key === "red" ? matchesLight(item, "red") || matchesLight(item, "refused") : matchesLight(item, key));
  const shownItems = items.filter((item) => matches(item, filter));

  return (
    <div className="page orders-page">
      <PageHeader title="Orders" meta={<time suppressHydrationWarning>{longDay(now)}</time>} />
      <section className="glass pad verdict" aria-labelledby="orders-verdict">
        <p className="verdict-label">Orders</p>
        <h2 className="verdict-title" id="orders-verdict">
          {snapshot.locked ? LOCKED_NOTE : !ready ? "Loading…" : waiting > 0 ? `${count(waiting)} ${waiting === 1 ? "order needs" : "orders need"} you.` : "Nothing needs you."}
        </h2>
        {ready && waiting > 0 ? (
          <button type="button" className="btn btn-primary verdict-action" onClick={() => setFilter("orange")}>
            Check {waiting === 1 ? "it" : `${count(waiting)} orders`}
          </button>
        ) : null}
      </section>
      <div className="count-tiles" role="group" aria-label="Show">
        {tiles.map((tile) => (
          <button key={tile.key} type="button" className="count-tile" data-tone={tile.value > 0 ? tile.tone : undefined} aria-pressed={filter === tile.key} onClick={() => pick(tile.key)}>
            <span className="count-tile-number">{count(tile.value)}</span>
            <span className="count-tile-word">{tile.word}</span>
          </button>
        ))}
      </div>
      {shownItems.length === 0 ? (
        <p className="empty-frame quiet-empty">
          {!ready ? (
            "Loading…"
          ) : (
            <>
              <PackageOpen aria-hidden="true" />
              <span>{filter === "all" ? "No orders yet." : "None."}</span>
              {filter === "all" ? (
                <Link href="/buyer" className="text-link strong">
                  Today
                </Link>
              ) : null}
            </>
          )}
        </p>
      ) : (
        <div className="log-list">
          <HistoryRows items={shownItems} onOpenOrder={ui.openOrder} />
        </div>
      )}
    </div>
  );
}
