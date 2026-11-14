"use client";

import { CalendarDays, Timer } from "lucide-react";
import { longDay } from "@/lib/console/format/time";
import { overviewVerdict, seconds } from "@/lib/supplier-console/format";
import { useAllActivity, useOverview } from "@/lib/supplier-console/hooks";
import { PageHeader } from "../shell/PageHeader";
import { useNow } from "../ui/useNow";
import { AgentList } from "./AgentList";
import { BlockNote, ControlFoot } from "./bits";
import { ControlKpis } from "./ControlKpis";
import { DayStrip } from "./DayStrip";
import { DemandFlow, weekFlow } from "./DemandFlow";
import { LiveCalls } from "./LiveCalls";
import { RuleBars } from "./RuleBars";
import { UnservedPanel } from "./UnservedPanel";

/** Valio Aimo's seat: where the week's demand went, who is calling now, which agents buy, what went unserved and which rules held orders. */
export function OverviewScreen() {
  const { data: overview, error, locked } = useOverview();
  const { data: activity } = useAllActivity();
  const now = useNow(30_000);
  const verdict = overview ? overviewVerdict(overview) : undefined;
  const speed = overview?.orders.medianSecondsRequestToConfirmed;
  const note = overview ? weekFlow(overview, activity).note : undefined;

  return (
    <div className="page control-page">
      <PageHeader
        title="Overview"
        meta={<time suppressHydrationWarning>{longDay(now)}</time>}
        actions={
          <span className="state period">
            <CalendarDays aria-hidden="true" />
            Last 7 days
          </span>
        }
        lede={
          verdict ? (
            <>
              <strong className="verdict-lead">{verdict.lead}</strong> {verdict.reason}
            </>
          ) : locked ? undefined : error ? (
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
            <section className="block" aria-labelledby="flow-title" data-tour="valio-flow">
              <header className="block-head">
                <h2 id="flow-title">Where demand went</h2>
                <span className="block-meta">Euro values are net</span>
              </header>
              <div className="card flow-card">
                <DemandFlow overview={overview} activity={activity} />
                {note || speed !== undefined ? (
                  <div className="flow-foot">
                    {speed !== undefined ? (
                      <p className="flow-speed">
                        <Timer aria-hidden="true" />
                        Median {seconds(speed)} from request to confirmed order, without a person.
                      </p>
                    ) : null}
                    {note ? <p className="flow-note">{note}</p> : null}
                  </div>
                ) : null}
                <DayStrip daily={overview.daily} />
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
      ) : locked ? null : (
        <BlockNote>{error ? "The overview could not be loaded. It retries every two seconds." : "Loading agents, demand and rules…"}</BlockNote>
      )}
      <ControlFoot />
    </div>
  );
}
