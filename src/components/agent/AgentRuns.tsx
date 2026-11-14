"use client";

import { useMemo, useState } from "react";
import type { Order } from "@/lib/contracts";
import { isSeeded } from "@/lib/console/format/orders";
import { buildRuns, type RunBlock as Run } from "@/lib/console/runs";
import type { Activity, DemoRun } from "@/lib/console/types";
import { useUi } from "../shell/ui-context";
import { RunBlock } from "./RunBlock";

const FIRST = 6;

interface AgentRunsProps {
  activity: Activity[];
  orders: Order[];
  run?: DemoRun;
  approver?: string;
  ready: boolean;
}

/** The buyer's own words, when the console started a single-request run. */
function activeRequest(run: DemoRun | undefined): string | undefined {
  if (!run || run.status !== "running") return undefined;
  if (run.scenario && run.scenario !== "milk") return undefined;
  return run.request || undefined;
}

/** Demo history: every order the run placed was seeded, or, with no order, its first activity was. */
function seededRun(run: Run, orders: Map<string, Order>, activity: Map<string, Activity>): boolean {
  const placed = run.orderIds.map((id) => orders.get(id)).filter((order): order is Order => Boolean(order));
  if (placed.length > 0) return placed.every(isSeeded);
  const first = activity.get(run.id);
  return first ? isSeeded(first) : false;
}

/** Everything the agent did, one block per request, newest first. */
export function AgentRuns({ activity, orders, run, approver, ready }: AgentRunsProps) {
  const ui = useUi();
  const [showAll, setShowAll] = useState(false);
  const running = run?.status === "running";
  const runs = useMemo(() => buildRuns(activity, orders), [activity, orders]);
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const activityMap = useMemo(() => new Map(activity.map((item) => [item.id, item])), [activity]);
  const shown = showAll ? runs : runs.slice(0, FIRST);

  return (
    <section className="block" aria-labelledby="runs-title">
      <header className="block-head">
        <h2 id="runs-title">
          What your agent did <span className="count">{runs.length}</span>
        </h2>
        <span className="block-meta">{running ? "Working now" : "Newest first"}</span>
      </header>
      {runs.length === 0 ? (
        <p className="empty-frame">{ready ? "No requests yet. Ask your agent for something, or pick a demo scene." : "Loading what your agent did…"}</p>
      ) : (
        <div className="runs" aria-live="polite" data-tour="runs">
          {shown.map((block, index) => (
            <RunBlock
              key={block.id}
              run={block}
              newest={index === 0}
              seeded={seededRun(block, orderMap, activityMap)}
              ctx={{ orders: orderMap, active: running && index === 0, activeRequest: activeRequest(run), approver }}
              onOpenOrder={ui.openOrder}
            />
          ))}
          {runs.length > FIRST ? (
            <button type="button" className="btn btn-quiet more" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show ${runs.length - FIRST} earlier ${runs.length - FIRST === 1 ? "request" : "requests"}`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
