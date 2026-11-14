"use client";

import { useMemo, useState } from "react";
import { count, eur } from "@/lib/console/format/money";
import { plural, REASONS, reasonTotals, unmetNet } from "@/lib/supplier-console/format";
import { useOverview } from "@/lib/supplier-console/hooks";
import type { UnmetReason } from "@/lib/supplier-console/types";
import { PageHeader } from "../shell/PageHeader";
import { Dash } from "../ui/Dash";
import { HistoryNote } from "../ui/HistoryNote";
import { BlockNote, ControlFoot } from "./bits";
import { ConceptBars } from "./ConceptBars";
import { UnmetTable } from "./UnmetTable";

type Filter = UnmetReason | "all";

/** What agents ask for, and what Valio Aimo could not serve and why. */
export function DemandScreen() {
  const { data: overview, error, locked } = useOverview();
  const [filter, setFilter] = useState<Filter>("all");
  const unmet = useMemo(() => overview?.unmet ?? [], [overview]);
  const totals = useMemo(() => reasonTotals(unmet), [unmet]);
  const shown = filter === "all" ? unmet : unmet.filter((item) => item.reason === filter);

  return (
    <div className="page control-page">
      <PageHeader
        title="Demand"
        meta={overview ? `${count(overview.demand.requests)} requests` : undefined}
        lede="What agents wanted, and what they left without. A webshop log never shows this demand, because nothing ever reached a basket."
      />
      {overview ? (
        <>
          <ConceptBars concepts={overview.demand.topConcepts} requests={overview.demand.requests} unmet={unmet} />
          <section className="block" id="unserved" aria-labelledby="unmet-title">
            <header className="block-head">
              <h2 id="unmet-title">
                What we could not serve <span className="count">{eur(unmetNet(unmet))}</span>
              </h2>
              <span className="block-meta">Estimated net, from the price each request would have had</span>
            </header>
            <dl className="kpis reason-totals">
              {totals.map((total) => (
                <div key={total.key} className="kpi" data-reason={total.key} data-zero={total.net === 0 || undefined}>
                  <dt>{total.label}</dt>
                  <dd>
                    <span className="kpi-value">
                      {total.count === 0 ? <Dash reason="no requests" /> : total.net > 0 ? eur(total.net) : <Dash reason={`${plural(total.count, "request")} · no price`} />}
                    </span>
                    {total.net > 0 ? (
                      <span className="kpi-sub">
                        {plural(total.count, "request")}
                        {total.unpriced > 0 ? ` · ${total.unpriced} without a price` : ""}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="filter-row" role="group" aria-label="Filter by reason">
              <button type="button" className="filter-chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                All <span className="count">{unmet.length}</span>
              </button>
              {REASONS.map((reason) => (
                <button key={reason.key} type="button" className="filter-chip" aria-pressed={filter === reason.key} onClick={() => setFilter(reason.key)}>
                  {reason.label} <span className="count">{totals.find((total) => total.key === reason.key)?.count ?? 0}</span>
                </button>
              ))}
            </div>
            <UnmetTable rows={shown} filtered={filter !== "all"} />
            <HistoryNote show={shown.some((item) => item.seeded)} />
          </section>
        </>
      ) : locked ? null : (
        <BlockNote>{error ? `Could not load demand: ${error}` : "Loading demand…"}</BlockNote>
      )}
      <ControlFoot />
    </div>
  );
}
