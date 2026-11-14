import type { SupplierOverview } from "@/lib/contracts";
import { SCRIPTED_CLIENT, UNKNOWN_CLIENT } from "@/lib/http/client-app";
import { isActiveAgent } from "@/lib/supplier-console/format";
import { agentName, clientName } from "@/lib/supplier-console/names";

/** One row of the connected-agents fragment on the landing page. */
export interface AgentRow {
  name: string;
  buyer: string;
  via: string;
  orders: string;
  live: boolean;
}

export interface AgentsView {
  agents: AgentRow[];
  activeNow: number;
  unmet: { text: string; note: string };
}

const SHOWN = 3;

/** What the page shows before the overview answers, and if it never does: the scene the demo plays. */
export const FALLBACK_AGENTS: AgentsView = {
  agents: [
    { name: "Harbour purchasing agent", buyer: "Nordic Harbour Hotels", via: "MCP", orders: "4 orders", live: true },
    { name: "Kaisla menu planner", buyer: "Kaisla School Kitchens", via: "REST", orders: "2 orders", live: true },
    { name: "Laine kitchen assistant", buyer: "Ravintola Laine", via: "MCP", orders: "1 order", live: false },
  ],
  activeNow: 2,
  unmet: { text: "Arla fat-free UHT milk drink: 200 l asked, 51 in stock.", note: "A signed alternative was offered." },
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The app an agent last called from, or the protocol when only the scripted agent or an unnamed caller used it. */
function via(clients: string[]): string {
  const named = clients.find((client) => client !== SCRIPTED_CLIENT && client !== UNKNOWN_CLIENT);
  return named ? clientName(named) : "REST";
}

/** The fragment's rows from the live overview: the three busiest agents, their buyers and orders, and the newest unserved request. */
export function agentsView(overview: SupplierOverview): AgentsView {
  const ranked = [...overview.agents].sort((a, b) => b.calls - a.calls).slice(0, SHOWN);
  const agents = ranked.map((agent) => {
    const placed = agent.orders.confirmed_auto + agent.orders.confirmed_after_approval;
    return {
      name: agentName(agent.agent),
      buyer: agent.buyer?.name ?? "No buyer named",
      via: via(agent.clients),
      orders: plural(placed, "order"),
      live: isActiveAgent(agent),
    };
  });
  const missed = overview.unmet[0];
  const unmet = missed
    ? { text: `${missed.words ?? missed.concept ?? "A request"}${missed.buyer ? `, from ${missed.buyer.name}` : ""}.`, note: missed.reasonText }
    : FALLBACK_AGENTS.unmet;
  return { agents: agents.length > 0 ? agents : FALLBACK_AGENTS.agents, activeNow: agents.filter((agent) => agent.live).length, unmet };
}
