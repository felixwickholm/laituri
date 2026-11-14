"use client";

import { FALLBACK_AGENTS, agentsView } from "./agent-rows";
import { useOverview } from "./useOverview";

/**
 * A crop of Valio Aimo control: who is buying through the door, and what it could not sell. It reads the live
 * overview; the server renders the demo scene's rows until the overview answers.
 */
export function AgentsFragment() {
  const overview = useOverview();
  const view = overview ? agentsView(overview) : FALLBACK_AGENTS;
  return (
    <div className="ui-card ui-agents" data-ui="agents" inert>
      <div className="ui-row">
        <span className="ui-title">Connected agents</span>
        <span className="ui-muted">
          <span className="live-dot" aria-hidden="true" /> {view.activeNow} active now
        </span>
      </div>
      <ul className="ui-agent-list">
        {view.agents.map((agent) => (
          <li key={agent.name} className="ui-agent">
            <span className="ui-agent-mark" data-live={agent.live} aria-hidden="true" />
            <span className="ui-agent-name">
              {agent.name}
              <span className="ui-muted">{agent.buyer}</span>
            </span>
            <span className="ui-tag">{agent.via}</span>
            <span className="ui-agent-orders">{agent.orders}</span>
          </li>
        ))}
      </ul>
      <div className="ui-unmet">
        <span className="ui-pill" data-tone="warn">
          Unmet demand
        </span>
        <p>
          {view.unmet.text}
          <span className="ui-muted"> {view.unmet.note}</span>
        </p>
      </div>
    </div>
  );
}
