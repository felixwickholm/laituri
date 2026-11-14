import Link from "next/link";
import type { ReactNode } from "react";
import { count, eur } from "@/lib/console/format/money";
import { ago, isActiveAgent, percent, plural, unmetInWeek, unmetNet, weekFigures } from "@/lib/supplier-console/format";
import type { ControlOverview } from "@/lib/supplier-console/types";
import { CountUp } from "../ui/CountUp";

/** A KPI's name, and under it the window and what it counts. */
function Term({ href, name, window }: { href?: string; name: string; window: string }) {
  return (
    <dt>
      {href ? (
        <Link href={href} className="kpi-link">
          {name}
        </Link>
      ) : (
        name
      )}
      <span className="kpi-window">{window}</span>
    </dt>
  );
}

function Kpi({ term, value, sub, lead }: { term: ReactNode; value: ReactNode; sub: ReactNode; lead?: boolean }) {
  return (
    <div className="kpi" data-lead={lead || undefined}>
      {term}
      <dd>
        <span className="kpi-value">{value}</span>
        <span className="kpi-sub">{sub}</span>
      </dd>
    </div>
  );
}

/**
 * Five figures, each naming its window and what it counts. Requests, confirmed orders and unserved demand share the
 * same seven Helsinki days, and the orders shown beside requests are the requests that led to one, so they never exceed them.
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
    <dl className="kpis control-kpis" aria-label="Valio Aimo figures">
      <Kpi
        term={<Term href="/valio/agents" name="Connected agents" window="Active: a call in the last 24 h" />}
        value={
          <>
            {count(active)}
            <span className="kpi-of">/ {count(overview.agents.length)} active</span>
          </>
        }
        sub={
          <>
            {suspended > 0 ? <span className="tone-danger">{plural(suspended, "suspended", "suspended")} · </span> : null}
            Last call {ago(lastSeen, now)}
          </>
        }
      />
      <Kpi
        term={<Term href="/valio/demand" name="Requests" window="Last 7 days · products asked for" />}
        value={<CountUp value={week.requests} format={count} />}
        sub={`${count(week.ordered)} led to an order · ${count(week.today?.requests ?? 0)} today`}
      />
      <Kpi
        term={<Term name="Offer to order" window="All signed offers" />}
        value={overview.offers.signed > 0 ? percent(overview.offers.conversionRate) : "–"}
        sub={`${count(overview.offers.ordered)} of ${plural(overview.offers.signed, "signed offer")} ordered`}
      />
      <Kpi
        lead
        term={<Term name="Confirmed net" window="Last 7 days · confirmed orders" />}
        value={<CountUp value={week.confirmedNet} format={eur} />}
        sub={plural(week.confirmed, "confirmed order")}
      />
      <Kpi
        term={<Term href="/valio/demand#unserved" name="Unserved demand" window="Last 7 days · not met in full" />}
        value={<CountUp value={lost} format={eur} />}
        sub={unmet.length === 0 ? "Every request served" : `${plural(unmet.length, "request")}${unpriced > 0 ? ` · ${unpriced} without a price` : ""}`}
      />
    </dl>
  );
}
