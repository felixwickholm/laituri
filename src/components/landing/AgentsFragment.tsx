const AGENTS = [
  { name: "Harbour purchasing agent", buyer: "Nordic Harbour Hotels", via: "MCP", orders: "4 orders", live: true },
  { name: "Kaisla menu planner", buyer: "Kaisla School Kitchens", via: "REST", orders: "2 orders", live: true },
  { name: "Laine kitchen assistant", buyer: "Ravintola Laine", via: "MCP", orders: "1 order", live: false },
];

/** A true-to-product crop of Valio Aimo control: who is buying through the door, and what it could not sell. */
export function AgentsFragment() {
  return (
    <div className="ui-card ui-agents" data-ui="agents" inert>
      <div className="ui-row">
        <span className="ui-title">Connected agents</span>
        <span className="ui-muted">
          <span className="live-dot" aria-hidden="true" /> 2 active now
        </span>
      </div>
      <ul className="ui-agent-list">
        {AGENTS.map((agent) => (
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
          Arla fat-free UHT milk drink: 200 l asked, 51 in stock.
          <span className="ui-muted"> A signed alternative was offered.</span>
        </p>
      </div>
    </div>
  );
}
