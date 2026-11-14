"use client";

import { LiveAgentPanel } from "@/components/orb/LiveAgentPanel";
import { buyerOrders, weekStats } from "@/lib/console/format/orders";
import { longDay } from "@/lib/console/format/time";
import { todayVerdict } from "@/lib/console/format/verdict";
import { useConsole } from "@/lib/console/store";
import { AgentRuns } from "../agent/AgentRuns";
import { NeedsYou } from "../approvals/NeedsYou";
import { MandateCard } from "../mandate/MandateCard";
import { PageHeader } from "../shell/PageHeader";
import { useNow } from "../ui/useNow";
import { KpiStrip } from "./KpiStrip";

/** The buyer's day: the verdict, this week's figures, what the agent did and what waits for a person. */
export function TodayScreen() {
  const snapshot = useConsole();
  const now = useNow(60_000);
  const orders = buyerOrders(snapshot.orders, snapshot.mandate);
  const week = weekStats(orders, now);
  const broken = snapshot.chain.state === "broken";
  const verdict = todayVerdict(week, broken, orders.length > 0);

  return (
    <div className="page">
      <PageHeader
        title="Today"
        meta={<time suppressHydrationWarning>{longDay(now)}</time>}
        lede={
          <>
            <strong className="verdict-lead" data-tone={verdict.tone}>
              {snapshot.ready ? verdict.lead : "Loading today…"}
            </strong>{" "}
            {snapshot.ready ? verdict.reason : null}
          </>
        }
      />
      <KpiStrip week={week} weeklyLimit={snapshot.mandate?.mandate.limits.perWeek.amount} chain={snapshot.chain} />
      <div className="today-grid">
        <div className="today-main">
          <AgentRuns
            activity={snapshot.activity}
            orders={snapshot.orders}
            run={snapshot.run}
            approver={snapshot.mandate?.mandate.approval.approver.name}
            ready={snapshot.ready}
          />
        </div>
        <div className="today-side">
          <LiveAgentPanel snapshot={snapshot} />
          <NeedsYou orders={orders} paused={broken} ready={snapshot.ready} />
          <MandateCard mandate={snapshot.mandate} jwks={snapshot.jwks} />
        </div>
      </div>
    </div>
  );
}
