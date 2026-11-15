"use client";

import { useMemo, useState } from "react";
import { count, eur } from "@/lib/console/format/money";
import { REASONS, reasonTotals, unmetNet } from "@/lib/supplier-console/format";
import { useOverview } from "@/lib/supplier-console/hooks";
import type { UnmetReason } from "@/lib/supplier-console/types";
import { BlockNote, ValioHead } from "./bits";
import { ConceptBars } from "./ConceptBars";
import { UnmetTable } from "./UnmetTable";

type Filter = UnmetReason | "all";

/** What agents ask for, and what Valio Aimo could not serve and why. The reason boxes filter the table under them. */
export function DemandScreen() {
  const { data: overview, error, locked } = useOverview();
  const [filter, setFilter] = useState<Filter>("all");
  const unmet = useMemo(() => overview?.unmet ?? [], [overview]);
  const totals = useMemo(() => reasonTotals(unmet), [unmet]);
  const shown = filter === "all" ? unmet : unmet.filter((item) => item.reason === filter);
  const lost = unmetNet(unmet);
  const pick = (next: Filter) => setFilter(filter === next ? "all" : next);

  return (
    <div className="page control-page">
      <ValioHead title="Demand" date={overview ? `${count(overview.demand.requests)} requests, all time` : undefined} />
      {overview ? (
        <>
          <section className="glass pad week-card" id="unserved" aria-labelledby="unmet-title">
            <div className="verdict">
              <p className="verdict-label">Lost demand</p>
              <h2 className="verdict-title" id="unmet-title">
                {unmet.length === 0 ? "Every request was served." : lost > 0 ? `${eur(lost)} we could not sell.` : `${count(unmet.length)} requests we could not serve.`}
              </h2>
              {unmet.length > 0 ? <p className="verdict-line">Demand that a plain webshop does not record.</p> : null}
            </div>
            <div className="count-tiles" role="group" aria-label="Filter by reason">
              <button type="button" className="count-tile" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                <span className="count-tile-number">{count(unmet.length)}</span>
                <span className="count-tile-word">all</span>
              </button>
              {REASONS.map((reason) => {
                const n = totals.find((total) => total.key === reason.key)?.count ?? 0;
                return (
                  <button key={reason.key} type="button" className="count-tile" data-tone={n > 0 ? "warn" : undefined} aria-pressed={filter === reason.key} onClick={() => pick(reason.key)}>
                    <span className="count-tile-number">{count(n)}</span>
                    <span className="count-tile-word">{reason.label.toLowerCase()}</span>
                  </button>
                );
              })}
            </div>
          </section>
          {unmet.length > 0 ? <UnmetTable rows={shown} filtered={filter !== "all"} /> : null}
          <ConceptBars concepts={overview.demand.topConcepts} requests={overview.demand.requests} unmet={unmet} />
        </>
      ) : locked ? null : (
        <BlockNote>{error ? `Could not load demand: ${error}` : "Loading…"}</BlockNote>
      )}
    </div>
  );
}
