"use client";

import { longDay } from "@/lib/console/format/time";
import { overviewVerdict } from "@/lib/supplier-console/format";
import { useOverview } from "@/lib/supplier-console/hooks";
import { PageHeader } from "../shell/PageHeader";
import { useNow } from "../ui/useNow";
import { AgentList } from "./AgentList";
import { BlockNote, ControlFoot } from "./bits";
import { ControlKpis } from "./ControlKpis";
import { DailyChart } from "./DailyChart";
import { LiveCalls } from "./LiveCalls";
import { RuleBars } from "./RuleBars";
import { UnservedPanel } from "./UnservedPanel";

/** Valio Aimo's seat: which agents buy, what they asked for, what went unserved, and which rules held orders. */
export function OverviewScreen() {
  const { data: overview, error } = useOverview();
  const now = useNow(30_000);
  const verdict = overview ? overviewVerdict(overview) : undefined;

  return (
    <div className="page control-page">
      <PageHeader
        title="Overview"
        meta={<time suppressHydrationWarning>{longDay(now)}</time>}
        lede={
          verdict ? (
            <>
              <strong className="verdict-lead">
                {verdict.lead}
              </strong>{" "}
              {verdict.reason}
            </>
          ) : error ? (
            `Could not load the overview: ${error}`
          ) : (
            "Loading the overview…"
          )
        }
      />
      {overview ? (
        <>
          <ControlKpis overview={overview} now={now} />
          <div className="control-grid">
            <section className="block" aria-labelledby="daily-title">
              <header className="block-head">
                <h2 id="daily-title">Requests per day</h2>
                <span className="block-meta series-key">
                  <span className="swatch" data-series="requests" aria-hidden="true" />
                  Requests
                  <span className="swatch" data-series="orders" aria-hidden="true" />
                  Led to an order
                  <span className="key-note">· confirmed value under each day</span>
                </span>
              </header>
              <div className="card chart-card">
                <DailyChart daily={overview.daily} />
              </div>
            </section>
            <LiveCalls now={now} />
          </div>
          <AgentList agents={overview.agents} now={now} />
          <div className="control-grid even">
            <UnservedPanel unmet={overview.unmet} />
            <RuleBars rules={overview.rules} />
          </div>
        </>
      ) : (
        <BlockNote>{error ? "The overview could not be loaded. It retries every two seconds." : "Loading agents, demand and rules…"}</BlockNote>
      )}
      <ControlFoot />
    </div>
  );
}
