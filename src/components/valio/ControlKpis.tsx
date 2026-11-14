import Link from "next/link";
import type { ReactNode } from "react";
import { count, eur } from "@/lib/console/format/money";
import { ago, isActiveAgent, percent, plural, unmetInWeek, unmetNet, weekFigures } from "@/lib/supplier-console/format";
import type { ControlOverview } from "@/lib/supplier-console/types";
import { CountUp } from "../ui/CountUp";
import { Dash } from "../ui/Dash";

function Kpi({ name, href, value, sub, lead }: { name: string; href?: string; value: ReactNode; sub: ReactNode; lead?: boolean }) {
  return (
    <div className="kpi" data-lead={lead || undefined}>
      <dt>
        {href ? (
          <Link href={href} className="kpi-link">
            {name}
          </Link>
        ) : (
          name
        )}
      </dt>
      <dd>
        <span className="kpi-value">{value}</span>
        <span className="kpi-sub">{sub}</span>
      </dd>
    </div>
  );
}

/**
 * Five figures: one label, one large figure, one short line. The period sits once above the strip. Requests,
 * confirmed orders and unserved demand share the same seven Helsinki days; a zero or missing figure is a dash.
 */
export function ControlKpis({ overview, now }: { overview: ControlOverview; now: number }) {
  const week = weekFigures(overview.daily);
  const active = overview.agents.filter(isActiveAgent).length;
  const suspended = overview.agents.filter((agent) => agent.status === "suspended").length;
  const lastSeen = overview.agents.map((agent) => agent.lastSeen).sort().at(-1);
  const unmet = unmetInWeek(overview.unmet, overview.daily);
  const lost = unmetNet(unmet);
  const unpriced = unmet.filter((item) => item.estimatedLostNet === undefined).length;

  return (
    <dl className="kpis control-kpis" aria-label="Valio Aimo figures, last 7 days">
      <Kpi
        name="Active agents"
        href="/valio/agents"
        value={overview.agents.length === 0 ? <Dash reason="none connected" /> : count(active)}
        sub={
          overview.agents.length === 0 ? (
            "Connect one to start"
          ) : (
            <>
              of {count(overview.agents.length)} connected{suspended > 0 ? <span className="tone-danger"> · {count(suspended)} suspended</span> : null} · last
              call {ago(lastSeen, now)}
            </>
          )
        }
      />
      <Kpi
        name="Requests"
        href="/valio/demand"
        value={week.requests === 0 ? <Dash reason="none yet" /> : <CountUp value={week.requests} format={count} />}
        sub={`${count(week.ordered)} led to an order`}
      />
      <Kpi
        name="Offer to order"
        value={overview.offers.signed > 0 ? percent(overview.offers.conversionRate) : <Dash reason="no offers signed" />}
        sub={`${count(overview.offers.ordered)} of ${plural(overview.offers.signed, "signed offer")}`}
      />
      <Kpi
        lead
        name="Confirmed, net"
        value={week.confirmedNet > 0 ? <CountUp value={week.confirmedNet} format={eur} /> : <Dash reason="nothing confirmed" />}
        sub={plural(week.confirmed, "confirmed order")}
      />
      <Kpi
        name="Unserved demand, net"
        href="/valio/demand#unserved"
        value={
          unmet.length === 0 ? (
            <Dash reason="every request served" />
          ) : lost > 0 ? (
            <CountUp value={lost} format={eur} />
          ) : (
            <Dash reason={`${plural(unmet.length, "request")} · no price`} />
          )
        }
        sub={unmet.length === 0 ? "On time and in full" : `${plural(unmet.length, "request")}${unpriced > 0 && lost > 0 ? ` · ${unpriced} without a price` : ""}`}
      />
    </dl>
  );
}
