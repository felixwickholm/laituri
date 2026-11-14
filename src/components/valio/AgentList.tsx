import { ArrowRight, Bot } from "lucide-react";
import Link from "next/link";
import { count, eur } from "@/lib/console/format/money";
import { ago } from "@/lib/supplier-console/format";
import { agentName } from "@/lib/supplier-console/names";
import type { ControlAgent } from "@/lib/supplier-console/types";
import { ClientChips, EmptyState, StatusMark } from "./bits";

/** The connected agents in brief: who they buy for, through which apps, how busy, and what they bought. */
export function AgentList({ agents, now }: { agents: ControlAgent[]; now: number }) {
  return (
    <section className="block" aria-labelledby="agents-title" data-tour="valio-agents">
      <header className="block-head">
        <h2 id="agents-title">
          Connected agents <span className="count">{agents.length}</span>
        </h2>
        <Link href="/valio/agents" className="text-link block-link">
          All agents
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      {agents.length === 0 ? (
        <EmptyState icon={Bot} text="No agent yet." action={{ href: "/connect", label: "Connect an agent" }} />
      ) : (
        <ul className="card agent-list">
          {agents.map((agent) => (
            <li key={agent.agent.id} className="agent-line" data-status={agent.status}>
              <span className="agent-who">
                <Link href={`/valio/agents?agent=${encodeURIComponent(agent.agent.id)}`} className="agent-name">
                  {agentName(agent.agent)}
                </Link>
                <span className="sub">{agent.buyer?.name ?? "No customer named"}</span>
              </span>
              <span className="agent-apps">
                <ClientChips clients={agent.clients} />
              </span>
              <span className="agent-figure">
                <span className="num">{count(agent.calls)}</span>
                <span className="sub">calls</span>
              </span>
              <span className="agent-figure">
                <span className="num strong">{agent.confirmedNet > 0 ? eur(agent.confirmedNet) : "–"}</span>
                <span className="sub">bought</span>
              </span>
              <span className="agent-state">
                <StatusMark agent={agent} />
                <span className="sub">{ago(agent.lastSeen, now)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
