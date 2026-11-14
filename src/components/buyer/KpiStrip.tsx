import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { count, eur, percentOf } from "@/lib/console/format/money";
import type { WeekStats } from "@/lib/console/format/orders";
import type { ChainState } from "@/lib/console/types";
import { CountUp } from "../ui/CountUp";

interface KpiStripProps {
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
        <>
          <span className="kpi-value">0</span>
          <span className="kpi-sub">No steps logged yet</span>
        </>
      );
  }
}

/** This week at a glance: spend against the limit, confirmed orders, the queue, and whether the log holds. */
export function KpiStrip({ week, weeklyLimit, chain }: KpiStripProps) {
  const used = weeklyLimit ? percentOf(week.spent, weeklyLimit) : 0;
  const meterTone = used >= 100 ? "danger" : used >= 80 ? "waiting" : "accent";
  return (
    <dl className="kpis" aria-label="This week">
      <div className="kpi">
        <dt>Spent this week</dt>
        <dd>
          <span className="kpi-value">
            <CountUp value={week.spent} format={eur} />
          </span>
          <span className="kpi-sub">{weeklyLimit ? `of ${eur(weeklyLimit)} weekly limit · ${used}%` : "Weekly limit loading"}</span>
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
          <span className="kpi-value">{count(week.confirmed)}</span>
          <span className="kpi-sub">
            {week.confirmed === 0 ? "None this week yet" : `${week.confirmedAuto} automatically · ${week.confirmedApproved} approved`}
          </span>
        </dd>
      </div>
      <div className="kpi">
        <dt>Waiting for you</dt>
        <dd>
          <span className={`kpi-value${week.waiting > 0 ? " tone-waiting" : ""}`}>{count(week.waiting)}</span>
          <span className="kpi-sub">{week.waiting > 0 ? `${eur(week.waitingAmount)} net to decide` : "Nothing waiting"}</span>
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
