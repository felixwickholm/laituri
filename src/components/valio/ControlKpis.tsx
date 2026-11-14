import Link from "next/link";
import { count, eur } from "@/lib/console/format/money";
import { ago, percent, plural, unmetNet, weekFigures } from "@/lib/supplier-console/format";
import type { ControlOverview } from "@/lib/supplier-console/types";
import { CountUp } from "../ui/CountUp";

/** Five figures for the last seven days, each with the plain comparison its data supports. */
export function ControlKpis({ overview, now }: { overview: ControlOverview; now: number }) {
  const week = weekFigures(overview.daily);
  const active = overview.agents.filter((agent) => agent.status === "active").length;
  const suspended = overview.agents.filter((agent) => agent.status === "suspended").length;
  const lastSeen = overview.agents.map((agent) => agent.lastSeen).sort().at(-1);
  const confirmed = overview.orders.byOutcome.confirmed_auto.count + overview.orders.byOutcome.confirmed_after_approval.count;
  const lost = unmetNet(overview.unmet);
  const unpriced = overview.unmet.filter((item) => item.estimatedLostNet === undefined).length;

  return (
    <dl className="kpis control-kpis" aria-label="Last 7 days">
      <div className="kpi">
        <dt>
          <Link href="/valio/agents" className="kpi-link">
            Connected agents
          </Link>
        </dt>
        <dd>
          <span className="kpi-value">
            {count(active)}
            <span className="kpi-of">/ {count(overview.agents.length)} active</span>
          </span>
          <span className="kpi-sub">
            {suspended > 0 ? <span className="tone-danger">{plural(suspended, "suspended", "suspended")} · </span> : null}
            Last call {ago(lastSeen, now)}
          </span>
        </dd>
      </div>
      <div className="kpi">
        <dt>
          <Link href="/valio/demand" className="kpi-link">
            Requests
          </Link>
        </dt>
        <dd>
          <span className="kpi-value">
            <CountUp value={week.requests} format={count} />
          </span>
          <span className="kpi-sub">{week.today ? `${count(week.today.requests)} today · ${count(week.orders)} orders placed` : "Last 7 days"}</span>
        </dd>
      </div>
      <div className="kpi">
        <dt>Offer to order</dt>
        <dd>
          <span className="kpi-value">{overview.offers.signed > 0 ? percent(overview.offers.conversionRate) : "–"}</span>
          <span className="kpi-sub">
            {count(overview.offers.ordered)} of {plural(overview.offers.signed, "signed offer")} ordered
          </span>
        </dd>
      </div>
      <div className="kpi" data-lead="true">
        <dt>Confirmed net</dt>
        <dd>
          <span className="kpi-value">
            <CountUp value={week.confirmedNet} format={eur} />
          </span>
          <span className="kpi-sub">
            {plural(confirmed, "order")} · {count(overview.orders.byOutcome.confirmed_after_approval.count)} after approval
          </span>
        </dd>
      </div>
      <div className="kpi">
        <dt>
          <Link href="/valio/demand#unserved" className="kpi-link">
            Unserved demand
          </Link>
        </dt>
        <dd>
          <span className="kpi-value">
            <CountUp value={lost} format={eur} />
          </span>
          <span className="kpi-sub">
            {overview.unmet.length === 0 ? "Every request served" : `${plural(overview.unmet.length, "request")}${unpriced > 0 ? ` · ${unpriced} without a price` : ""}`}
          </span>
        </dd>
      </div>
    </dl>
  );
}
