"use client";

import { useCallback, useMemo, useState } from "react";
import { entriesPerDay, eventGroup, type EventGroup } from "@/lib/console/format/log";
import { count } from "@/lib/console/format/money";
import { longDay } from "@/lib/console/format/time";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { useConsole } from "@/lib/console/store";
import { AuditSheet } from "../proof/AuditSheet";
import { DayHistogram } from "../proof/DayHistogram";
import { LogHead } from "../proof/LogHead";
import { LogRows } from "../proof/LogRows";
import { TamperControl } from "../proof/TamperControl";
import { PageHeader } from "../shell/PageHeader";
import { useUi } from "../shell/ui-context";
import { useNow } from "../ui/useNow";

const PAGE = 25;
type Filter = EventGroup | "all";

/** The record in full: its verdict, a week of steps, and every step. */
export function LogScreen() {
  const { audit, chain, orders, jwks, ready, locked } = useConsole();
  const ui = useUi();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const newestFirst = useMemo(() => [...audit].reverse(), [audit]);
  const counts = useMemo(() => {
    const tally: Record<EventGroup, number> = { orders: 0, approvals: 0, agent: 0, mandate: 0, refused: 0 };
    for (const entry of audit) tally[eventGroup(entry.event)] += 1;
    return tally;
  }, [audit]);
  const filtered = filter === "all" ? newestFirst : newestFirst.filter((entry) => eventGroup(entry.event) === filter);
  const shown = filtered.slice(0, limit);
  const entry = audit.find((item) => item.seq === openSeq);
  const closeEntry = useCallback(() => setOpenSeq(null), []);
  const openOrder = useCallback(
    (id: string) => {
      setOpenSeq(null);
      ui.openOrder(id);
    },
    [ui],
  );

  const tiles: { key: Filter; word: string; value: number; tone?: "danger" }[] = [
    { key: "all", word: audit.length === 1 ? "step" : "steps", value: audit.length },
    { key: "orders", word: "orders", value: counts.orders },
    { key: "approvals", word: "approvals", value: counts.approvals },
    { key: "refused", word: "refused", value: counts.refused, tone: "danger" },
  ];
  const pick = (key: Filter) => {
    setFilter(filter === key && key !== "all" ? "all" : key);
    setLimit(PAGE);
  };

  return (
    <div className="page record-page">
      <PageHeader title="The record" meta={<time suppressHydrationWarning>{longDay(now)}</time>} />
      <section className="log-top" aria-label="Seal">
        <LogHead audit={audit} chain={chain} />
        <DayHistogram days={entriesPerDay(audit, now)} />
      </section>
      <div className="count-tiles" role="group" aria-label="Show">
        {tiles.map((tile) => (
          <button key={tile.key} type="button" className="count-tile" data-tone={tile.value > 0 ? tile.tone : undefined} aria-pressed={filter === tile.key} onClick={() => pick(tile.key)}>
            <span className="count-tile-number">{count(tile.value)}</span>
            <span className="count-tile-word">{tile.word}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="empty-frame">{locked ? LOCKED_NOTE : !ready ? "Loading…" : filter === "all" ? "No steps yet." : "None."}</p>
      ) : (
        <div className="log-list">
          <LogRows entries={shown} chain={chain} orders={orders} onOpen={setOpenSeq} />
        </div>
      )}
      {filtered.length > shown.length ? (
        <button type="button" className="btn btn-secondary more" onClick={() => setLimit(limit + PAGE)}>
          Show {Math.min(PAGE, filtered.length - shown.length)} more · {count(shown.length)} of {count(filtered.length)}
        </button>
      ) : null}
      <TamperControl broken={chain.state === "broken"} />
      <AuditSheet
        entry={entry}
        open={openSeq !== null}
        chain={chain}
        jwks={jwks}
        onClose={closeEntry}
        onOpenOrder={openOrder}
      />
    </div>
  );
}
