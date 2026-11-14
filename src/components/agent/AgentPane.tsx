"use client";

import { connectedAgent } from "@/lib/console/format/activity";
import type { Activity, DemoRun } from "@/lib/console/types";
import { Pane } from "../shell/Pane";
import { useUi } from "../shell/ui-context";
import { ActivityRow } from "./ActivityRow";

interface AgentPaneProps {
  activity: Activity[];
  run?: DemoRun;
  online: boolean;
  visible: boolean;
}

export function AgentPane({ activity, run, online, visible }: AgentPaneProps) {
  const ui = useUi();
  const agent = connectedAgent(activity);
  const running = run?.status === "running";
  const calls = activity.filter((item) => item.kind === "tool").length;
  const newestFirst = [...activity].reverse();
  return (
    <Pane id="agent" num={1} title="Agent" sub="What the agent does" visible={visible} live>
      <div className="live-row">
        <span className="live-dot" data-idle={!running} aria-hidden="true" />
        {agent ? (
          <span>
            <strong>{agent.name}</strong> {running ? "is working" : "connected"}
          </span>
        ) : (
          <span>No agent connected</span>
        )}
        <span className="meta mono">{calls === 1 ? "1 call" : `${calls} calls`}</span>
      </div>
      {newestFirst.length === 0 ? (
        <p className="pane-empty">
          {online ? "Quiet. Start a scene in the dock, or connect your own agent." : "The activity feed is not reachable yet."}
        </p>
      ) : (
        <ol className="stream" aria-label="Agent calls, newest first">
          {newestFirst.map((item) => (
            <ActivityRow key={item.id} activity={item} onOpen={ui.openOrder} />
          ))}
        </ol>
      )}
    </Pane>
  );
}
