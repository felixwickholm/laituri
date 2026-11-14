"use client";

import { useCallback, useMemo, useState } from "react";
import { EVENT_GROUPS, entriesPerDay, eventGroup, type EventGroup } from "@/lib/console/format/log";
import { count } from "@/lib/console/format/money";
import { isSeeded } from "@/lib/console/format/orders";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { useConsole } from "@/lib/console/store";
import { AuditSheet } from "../proof/AuditSheet";
import { DayHistogram } from "../proof/DayHistogram";
import { LogHead } from "../proof/LogHead";
import { LogRows } from "../proof/LogRows";
import { TamperControl } from "../proof/TamperControl";
import { PageHeader } from "../shell/PageHeader";
import { useUi } from "../shell/ui-context";
import { HistoryNote } from "../ui/HistoryNote";
import { useNow } from "../ui/useNow";

const PAGE = 25;
type Filter = EventGroup | "all";

/** The signed, chained log in full: its verdict, a week of activity, and every entry. */
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

  return (
    <div className="page">
      <PageHeader title="Log" meta={`${count(audit.length)} ${audit.length === 1 ? "entry" : "entries"}`} lede="Every step your agent, Valio Aimo and your approver took, signed and chained so nobody can change it unseen." />
      <div className="log-top">
        <LogHead audit={audit} chain={chain} />
        <DayHistogram days={entriesPerDay(audit, now)} />
      </div>
      <div className="filter-row chip-scroll" role="group" aria-label="Filter by event">
        <button type="button" className="filter-chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="count">{audit.length}</span>
        </button>
        {EVENT_GROUPS.map((group) => (
          <button key={group.key} type="button" className="filter-chip" aria-pressed={filter === group.key} onClick={() => {
              setFilter(group.key);
              setLimit(PAGE);
            }}>
            {group.label} <span className="count">{counts[group.key]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="empty-frame">{locked ? LOCKED_NOTE : !ready ? "Loading the log…" : filter === "all" ? "The log is empty. Every step your agent takes is signed and chained here." : "No entries of this kind."}</p>
      ) : (
        <div className="log-list">
          <HistoryNote show={shown.some(isSeeded)} />
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
