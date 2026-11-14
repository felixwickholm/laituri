"use client";

import { useMemo } from "react";
import type { Order } from "@/lib/contracts";
import { connectedAgent } from "@/lib/console/format/activity";
import { buildRuns } from "@/lib/console/runs";
import type { Activity, DemoRun } from "@/lib/console/types";
import { EmptyLine, Pane, type Feed } from "../shell/Pane";
import { useUi } from "../shell/ui-context";
import { RunBlock } from "./RunBlock";

interface AgentPaneProps {
  activity: Activity[];
  orders: Order[];
  run?: DemoRun;
  approver?: string;
  feed: Feed;
  visible: boolean;
}

/** The buyer's own words, when the console started a single-request run. */
function activeRequest(run: DemoRun | undefined): string | undefined {
  if (!run || run.status !== "running") return undefined;
  if (run.scenario && run.scenario !== "milk") return undefined;
  return run.request || undefined;
}

export function AgentPane({ activity, orders, run, approver, feed, visible }: AgentPaneProps) {
  const ui = useUi();
  const agent = connectedAgent(activity);
  const running = run?.status === "running";
  const runs = useMemo(() => buildRuns(activity, orders), [activity, orders]);
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const calls = activity.filter((item) => item.kind === "tool").length;

  return (
    <Pane id="agent" num={1} title="Agent" sub="What the agent does" visible={visible} live>
      <div className="live-row">
        <span className="live-dot" data-idle={!running} aria-hidden="true" />
        {agent ? (
          <span className="live-text">
            <strong>{agent.name}</strong> {running ? "is working" : "connected"}
          </span>
        ) : (
          <span className="live-text">No agent connected</span>
        )}
        <span className="meta mono">{calls === 1 ? "1 call" : `${calls} calls`}</span>
      </div>
      {runs.length === 0 ? (
        <EmptyLine feed={feed}>Quiet. Start a scene in the dock, or connect your own agent.</EmptyLine>
      ) : (
        <div className="runs">
          {runs.map((block, index) => (
            <RunBlock
              key={block.id}
              run={block}
              ctx={{ orders: orderMap, active: running && index === 0, activeRequest: activeRequest(run), approver }}
              onOpenOrder={ui.openOrder}
            />
          ))}
        </div>
      )}
    </Pane>
  );
}
