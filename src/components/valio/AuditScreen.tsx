"use client";

import { Download } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { EVENT_GROUPS, entriesPerDay, eventGroup, type EventGroup } from "@/lib/console/format/log";
import { count } from "@/lib/console/format/money";
import { useConsole } from "@/lib/console/store";
import { buyersOf, exportName, filterAudit, type AuditFilter } from "@/lib/supplier-console/format";
import { useOverview } from "@/lib/supplier-console/hooks";
import { AuditSheet } from "../proof/AuditSheet";
import { DayHistogram } from "../proof/DayHistogram";
import { LogHead } from "../proof/LogHead";
import { LogRows } from "../proof/LogRows";
import { PageHeader } from "../shell/PageHeader";
import { useUi } from "../shell/ui-context";
import { useNow } from "../ui/useNow";
import { BlockNote, ControlFoot } from "./bits";
import { OfferSummary } from "./OfferSummary";

const PAGE = 100;

/** Downloads the given entries as a JSON file, built in the browser. */
function download(name: string, entries: unknown[]): void {
  const blob = new Blob([JSON.stringify({ entries }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The same signed chain the buyer reads, from Valio Aimo's seat: every buyer, filterable, exportable. */
export function AuditScreen() {
  const { audit, chain, orders, jwks, ready } = useConsole();
  const { data: overview } = useOverview();
  const ui = useUi();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<AuditFilter>({ buyer: "all", group: "all" });
  const [limit, setLimit] = useState(PAGE);
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const buyers = useMemo(() => buyersOf(overview?.agents ?? []), [overview]);
  const byBuyer = useMemo(() => filterAudit(audit, { buyer: filter.buyer, group: "all" }), [audit, filter.buyer]);
  const filtered = useMemo(() => (filter.group === "all" ? byBuyer : byBuyer.filter((entry) => eventGroup(entry.event) === filter.group)), [byBuyer, filter.group]);
  const counts = useMemo(() => {
    const tally: Record<EventGroup, number> = { orders: 0, approvals: 0, agent: 0, mandate: 0, refused: 0 };
    for (const entry of byBuyer) tally[eventGroup(entry.event)] += 1;
    return tally;
  }, [byBuyer]);
  const shown = filtered.slice(0, limit);
  const lastSeq = audit.length ? audit[audit.length - 1].seq : 0;
  const entry = audit.find((item) => item.seq === openSeq);
  const buyerName = buyers.find((buyer) => buyer.id === filter.buyer)?.name;
  const closeEntry = useCallback(() => setOpenSeq(null), []);
  const openOrder = useCallback(
    (id: string) => {
      setOpenSeq(null);
      ui.openOrder(id);
    },
    [ui],
  );

  return (
    <div className="page control-page">
      <PageHeader
        title="Audit"
        meta={`${count(audit.length)} ${audit.length === 1 ? "entry" : "entries"}`}
        lede="One log, two readers: the buyer and Valio Aimo verify the same entries with the same public keys."
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            disabled={filtered.length === 0}
            onClick={() => download(exportName(new Date().toISOString(), buyerName), [...filtered].reverse())}
          >
            <Download aria-hidden="true" />
            Export JSON <span className="count">{count(filtered.length)}</span>
          </button>
        }
      />
      <div className="log-top">
        <LogHead chain={chain} lastSeq={lastSeq} audience="wholesaler" />
        <DayHistogram days={entriesPerDay(byBuyer, now)} />
      </div>
      {overview ? <OfferSummary offers={overview.offers} /> : null}
      <section className="block" aria-labelledby="entries-title">
        <header className="block-head">
          <h2 id="entries-title">
            Entries <span className="count">{count(filtered.length)}</span>
          </h2>
        </header>
        <div className="audit-filters">
          <div className="filter-row" role="group" aria-label="Filter by buyer">
            <button type="button" className="filter-chip" aria-pressed={filter.buyer === "all"} onClick={() => setFilter({ ...filter, buyer: "all" })}>
              All buyers
            </button>
            {buyers.map((buyer) => (
              <button key={buyer.id} type="button" className="filter-chip" aria-pressed={filter.buyer === buyer.id} onClick={() => setFilter({ ...filter, buyer: buyer.id })}>
                {buyer.name}
              </button>
            ))}
          </div>
          <div className="filter-row" role="group" aria-label="Filter by event">
            <button type="button" className="filter-chip" aria-pressed={filter.group === "all"} onClick={() => setFilter({ ...filter, group: "all" })}>
              All events <span className="count">{byBuyer.length}</span>
            </button>
            {EVENT_GROUPS.map((group) => (
              <button key={group.key} type="button" className="filter-chip" aria-pressed={filter.group === group.key} onClick={() => setFilter({ ...filter, group: group.key })}>
                {group.label} <span className="count">{counts[group.key]}</span>
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <BlockNote>{!ready ? "Loading the log…" : "No entries match these filters."}</BlockNote>
        ) : (
          <LogRows entries={shown} chain={chain} orders={orders} onOpen={setOpenSeq} />
        )}
        {filtered.length > shown.length ? (
          <button type="button" className="btn btn-secondary more" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, filtered.length - shown.length)} older entries · {count(shown.length)} of {count(filtered.length)} shown
          </button>
        ) : null}
      </section>
      <ControlFoot />
      <AuditSheet entry={entry} open={openSeq !== null} chain={chain} jwks={jwks} onClose={closeEntry} onOpenOrder={openOrder} />
    </div>
  );
}
