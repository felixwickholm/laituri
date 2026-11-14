import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { count, eur, percentOf } from "@/lib/console/format/money";
import type { WeekStats } from "@/lib/console/format/orders";
import type { ChainState } from "@/lib/console/types";
import { CountUp } from "../ui/CountUp";
import { Dash } from "../ui/Dash";

interface KpiStripProps {
  /** False until the first read: every figure shows a bare dash, never "nothing" it does not know yet. */
  ready: boolean;
  week: WeekStats;
  weeklyLimit?: number;
  chain: ChainState;
}

function steps(n: number): string {
  return n === 1 ? "1 step" : `${count(n)} steps`;
}

function LogCell({ chain }: { chain: ChainState }) {
  switch (chain.state) {
    case "broken":
      return (
        <>
          <span className="kpi-value tone-danger">
            <CircleX aria-hidden="true" />
            Broken
          </span>
          <span className="kpi-sub">Entry {chain.brokenAt} was changed</span>
        </>
      );
    case "verified":
      return (
        <>
          <span className="kpi-value tone-success">
            <CircleCheck aria-hidden="true" />
            Verified
          </span>
          <span className="kpi-sub">{steps(chain.entries)} · checked in your browser</span>
        </>
      );
    case "checking":
      return (
        <>
          <span className="kpi-value">
            <LoaderCircle className="spin" aria-hidden="true" />
            Checking
          </span>
          <span className="kpi-sub">{steps(chain.entries)}</span>
        </>
      );
    default:
      return (
        <span className="kpi-value">
          <Dash reason="Nothing logged yet" />
        </span>
      );
  }
}

/** This week at a glance: spend against the limit, confirmed orders, the queue, and whether the log holds. */
export function KpiStrip({ ready, week, weeklyLimit, chain }: KpiStripProps) {
  if (!ready) {
    return (
      <dl className="kpis" aria-label="This week" aria-busy="true">
        {["Net spend this week", "Orders confirmed", "Waiting for you", "Log"].map((label) => (
          <div className="kpi" key={label}>
            <dt>{label}</dt>
            <dd>
              <span className="kpi-value">
                <Dash />
              </span>
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  const used = weeklyLimit ? percentOf(week.spent, weeklyLimit) : 0;
  const meterTone = used >= 100 ? "danger" : used >= 80 ? "waiting" : "accent";
  return (
    <dl className="kpis" aria-label="This week">
      <div className="kpi">
        <dt>Net spend this week</dt>
        <dd>
          <span className="kpi-value">{week.spent > 0 ? <CountUp value={week.spent} format={eur} /> : <Dash reason="Nothing spent yet" />}</span>
          <span className="kpi-sub">{weeklyLimit ? `${used}% of the ${eur(weeklyLimit)} weekly limit` : "Weekly limit loading"}</span>
          <span
            className="meter"
            role="meter"
            aria-label="Weekly limit used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(used, 100)}
            data-tone={meterTone}
          >
            <span style={{ transform: `scaleX(${Math.min(used, 100) / 100})` }} />
          </span>
        </dd>
      </div>
      <div className="kpi">
        <dt>Orders confirmed</dt>
        <dd>
          {week.confirmed === 0 ? (
            <span className="kpi-value">
              <Dash reason="None this week yet" />
            </span>
          ) : (
            <>
              <span className="kpi-value">{count(week.confirmed)}</span>
              <span className="kpi-sub">
                {week.confirmedAuto} on its own · {week.confirmedApproved} approved
              </span>
            </>
          )}
        </dd>
      </div>
      <div className="kpi">
        <dt>Waiting for you</dt>
        <dd>
          {week.waiting > 0 ? (
            <>
              <span className="kpi-value tone-waiting">{count(week.waiting)}</span>
              <span className="kpi-sub">{eur(week.waitingAmount)} net to decide</span>
            </>
          ) : (
            <span className="kpi-value">
              <Dash reason="Nothing waiting" />
            </span>
          )}
        </dd>
      </div>
      <div className="kpi">
        <dt>
          <Link href="/buyer/log" className="kpi-link">
            Log
          </Link>
        </dt>
        <dd>
          <LogCell chain={chain} />
        </dd>
      </div>
    </dl>
  );
}
