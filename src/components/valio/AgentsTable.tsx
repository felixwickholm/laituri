import { count, eur } from "@/lib/console/format/money";
import { day } from "@/lib/console/format/time";
import { ago, orderCount } from "@/lib/supplier-console/format";
import type { ControlAgent } from "@/lib/supplier-console/types";
import { Dash } from "../ui/Dash";
import { ClientChips, StatusMark } from "./bits";
import { agentName } from "@/lib/supplier-console/names";

interface AgentsTableProps {
  /** Undefined while loading: the table shows its shape with placeholder rows. */
  agents?: ControlAgent[];
  now: number;
  onOpen: (agentId: string) => void;
}

/** The cell classes of a row, so placeholder rows collapse on a phone the same way real rows do. */
const SKELETON_CELLS = ["cell-agent", "cell-apps", "cell-seen", "cell-calls", "cell-quotes", "cell-orders", "cell-net", "cell-status"];

/** Every agent that reached Valio Aimo: who it buys for, how it connects, how busy it is and how its orders ended. */
export function AgentsTable({ agents, now, onOpen }: AgentsTableProps) {
  return (
    <div className="table-frame agents-frame" aria-busy={agents === undefined}>
      <table className="agents-table">
        <thead>
          <tr>
            <th scope="col">Agent</th>
            <th scope="col">Apps</th>
            <th scope="col">Last seen</th>
            <th scope="col" className="num">
              Calls
            </th>
            <th scope="col" className="num">
              Prices
            </th>
            <th scope="col" className="num">
              Orders
            </th>
            <th scope="col" className="num">
              Bought, net
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {agents === undefined ? (
            [0, 1, 2].map((row) => (
              <tr key={row} className="skeleton-row" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => (
                  <td key={cell} className={SKELETON_CELLS[cell]}>
                    <span className="skeleton" />
                  </td>
                ))}
              </tr>
            ))
          ) : agents.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={8}>No agent has connected yet. Connect one on the Connect page.</td>
            </tr>
          ) : (
            agents.map((agent) => (
              <tr key={agent.agent.id} data-status={agent.status}>
                <td className="cell-agent">
                  <button type="button" className="row-open" onClick={() => onOpen(agent.agent.id)}>
                    {agentName(agent.agent)}
                  </button>
                  <span className="sub">{agent.buyer?.name ?? "No customer named"}</span>
                  <span className="apps-inline">
                    <ClientChips clients={agent.clients} max={3} />
                  </span>
                </td>
                <td className="cell-apps">
                  <ClientChips clients={agent.clients} max={4} />
                </td>
                <td className="cell-seen">
                  <span>{ago(agent.lastSeen, now)}</span>
                  <span className="sub">first {day(agent.firstSeen)}</span>
                </td>
                <td className="cell-calls num">
                  {count(agent.calls)}
                  <span className="phone-unit"> {agent.calls === 1 ? "call" : "calls"}</span>
                </td>
                <td className="cell-quotes num">
                  {count(agent.quotes)}
                  <span className="phone-unit"> {agent.quotes === 1 ? "price" : "prices"}</span>
                </td>
                <td className="cell-orders num">
                  {count(orderCount(agent.orders))}
                  <span className="phone-unit"> {orderCount(agent.orders) === 1 ? "order" : "orders"}</span>
                  {orderCount(agent.orders) > 0 ? <span className="sub">{count(agent.orders.confirmed_auto + agent.orders.confirmed_after_approval)} confirmed</span> : null}
                </td>
                <td className="cell-net num">{agent.confirmedNet > 0 ? eur(agent.confirmedNet) : <Dash />}</td>
                <td className="cell-status">
                  <StatusMark agent={agent} />
                  <span className="sub status-seen">{ago(agent.lastSeen, now)}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
