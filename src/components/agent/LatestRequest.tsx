"use client";

import { useMemo } from "react";
import type { Order } from "@/lib/contracts";
import { buildRuns, demoRunOf } from "@/lib/console/runs";
import type { Activity, DemoRun } from "@/lib/console/types";
import { useUi } from "../shell/ui-context";
import { RunBlock } from "./RunBlock";

interface LatestRequestProps {
  activity: Activity[];
  orders: Order[];
  /** The single request this browser started; nothing shows without one. */
  run?: DemoRun;
}

/** The buyer's own words, while the request they typed is still running. */
function activeRequest(run: DemoRun | undefined): string | undefined {
  return run?.status === "running" ? run.request || undefined : undefined;
}

/** The single request just typed: its steps live while the agent works, then the result with its rule checks. */
export function LatestRequest({ activity, orders, run }: LatestRequestProps) {
  const ui = useUi();
  const runs = useMemo(() => buildRuns(activity, orders), [activity, orders]);
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const index = runs.findIndex((block, at) => demoRunOf(block, run, at) !== undefined);
  const block = index >= 0 ? runs[index] : undefined;
  if (!run || !block) return null;
  const running = run.status === "running";

  return (
    <section className="block latest-request" aria-label="Your request">
      <div className="runs" aria-live="polite" data-tour="runs">
        <RunBlock
          run={block}
          newest
          demoRun={run.id}
          ctx={{ orders: orderMap, active: running, activeRequest: activeRequest(run), approver: "the purchasing manager" }}
          onOpenOrder={ui.openOrder}
        />
      </div>
    </section>
  );
}
