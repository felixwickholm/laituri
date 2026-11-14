"use client";

import { count } from "@/lib/console/format/money";
import { landingFigures, shown } from "./counts";
import { useOverview } from "./useOverview";

/**
 * This demo week in one sentence, from the visitor's own workspace and the same seven days as Valio Aimo's overview.
 * Without the figures it says nothing rather than something untrue.
 */
export function WeekLine() {
  const figures = landingFigures(useOverview() ?? undefined);
  const { agents, requests, ordersConfirmed } = figures;
  if (!shown(agents) || !shown(requests) || !shown(ordersConfirmed)) return <p className="lp-week" aria-hidden="true" />;
  return (
    <p className="lp-week">
      This week: {count(agents)} agents, {count(requests)} requests, {count(ordersConfirmed)} orders.
    </p>
  );
}
