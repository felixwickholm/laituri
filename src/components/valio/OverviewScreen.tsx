"use client";

import { Timer } from "lucide-react";
import Link from "next/link";
import { longDay } from "@/lib/console/format/time";
import { overviewVerdict } from "@/lib/supplier-console/format";
import { useBaskets, useOverview } from "@/lib/supplier-console/hooks";
import { requestBars } from "@/lib/supplier-console/flow";
import { count } from "@/lib/console/format/money";
import { overviewAction, overviewTiles, speedLine } from "@/lib/supplier-console/overview";
import { UpstreamLine } from "../security/UpstreamLine";
import { useNow } from "../ui/useNow";
import { AgentList } from "./AgentList";
import { BlockNote, ValioHead } from "./bits";
import { DayStrip } from "./DayStrip";
import { weekFlow } from "./DemandFlow";
import { LiveCalls } from "./LiveCalls";
import { PlainBars } from "./PlainBars";
import { RuleBars } from "./RuleBars";
import { UnservedPanel } from "./UnservedPanel";

/** Valio Aimo's seat: one verdict for the week with four counts, then what happened to requests, live calls, agents, lost demand and rules. */
export function OverviewScreen() {
  const { data: overview, error, locked } = useOverview();
  const { data: baskets } = useBaskets();
  const now = useNow(30_000);
  const verdict = overview ? overviewVerdict(overview) : undefined;
  const tiles = overview ? overviewTiles(overview) : [];
  const action = overview ? overviewAction(overview) : undefined;
  const speed = overview ? speedLine(overview, baskets) : undefined;
  const flow = overview ? weekFlow(overview) : undefined;

  return (
    <div className="page control-page">
      <ValioHead
        title="Overview"
        date={<time suppressHydrationWarning>{longDay(now)} · last 7 days</time>}
        lead="What Valio Aimo sees: its customers’ agents, orders and the demand it missed."
      />
      {overview && verdict ? (
        <>
          <section className="glass pad week-card" aria-labelledby="week-title">
            <div className="verdict">
              <p className="verdict-label">Sales by agents</p>
              <h2 className="verdict-title" id="week-title">
                {verdict.lead}
              </h2>
              {verdict.reason ? <p className="verdict-line">{verdict.reason}</p> : null}
              {action ? (
                <Link href={action.href} className="btn btn-primary verdict-action">
                  {action.label}
                </Link>
              ) : null}
            </div>
            <ul className="count-tiles">
              {tiles.map((tile) => {
                const long = tile.number.length > 5;
                const body = (
                  <>
                    <span className="count-tile-number" data-long={long || undefined}>
                      {tile.number}
                    </span>
                    <span className="count-tile-word">{tile.word}</span>
                  </>
                );
                return tile.href ? (
                  <li key={tile.key} className="tile-cell" data-wide={long || undefined}>
                    <Link href={tile.href} className="count-tile" data-tone={tile.tone} data-tile={tile.key}>
                      {body}
                    </Link>
                  </li>
                ) : (
                  <li key={tile.key} className="count-tile" data-tone={tile.tone} data-tile={tile.key} data-wide={long || undefined}>
                    {body}
                  </li>
                );
              })}
            </ul>
          </section>
          <div className="control-grid">
            <section className="block" aria-labelledby="flow-title" data-tour="valio-flow">
              <header className="block-head">
                <h2 id="flow-title">
                  Requests <span className="count">{count(flow?.requests ?? 0)}</span>
                </h2>
              </header>
              <div className="card flow-card">
                {flow && flow.requests > 0 ? (
                  <PlainBars rows={requestBars(flow)} label="What happened to the week's requests" />
                ) : (
                  <p className="flow-empty">No agent has asked for anything in the last 7 days.</p>
                )}
                {speed ? (
                  <div className="flow-foot">
                    <p className="flow-speed">
                      <Timer aria-hidden="true" />
                      {speed}
                    </p>
                  </div>
                ) : null}
                <DayStrip daily={overview.daily} />
                <UpstreamLine />
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
        <BlockNote>{error ? "The overview could not be loaded. Trying again." : "Loading…"}</BlockNote>
      )}
    </div>
  );
}
