import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { count, eur } from "@/lib/console/format/money";
import { ago } from "@/lib/supplier-console/format";
import type { ControlAgent } from "@/lib/supplier-console/types";
import { ClientChips, StatusMark } from "./bits";

/** The connected agents in brief: who they buy for, through which apps, how busy, and what they bought. */
export function AgentList({ agents, now }: { agents: ControlAgent[]; now: number }) {
  return (
    <section className="block" aria-labelledby="agents-title">
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
        <p className="empty-frame">No agent has connected yet. The first call from a buyer&rsquo;s agent appears here.</p>
      ) : (
        <ul className="card agent-list">
          {agents.map((agent) => (
            <li key={agent.agent.id} className="agent-line" data-status={agent.status}>
              <span className="agent-who">
                <Link href={`/valio/agents?agent=${encodeURIComponent(agent.agent.id)}`} className="agent-name">
                  {agent.agent.name}
                </Link>
                <span className="sub">{agent.buyer?.name ?? "Unknown buyer"}</span>
              </span>
              <span className="agent-apps">
                <ClientChips clients={agent.clients} />
              </span>
              <span className="agent-figure">
                <span className="num">{count(agent.calls)}</span>
                <span className="sub">calls</span>
              </span>
              <span className="agent-figure">
                <span className="num strong">{eur(agent.confirmedNet)}</span>
                <span className="sub">confirmed</span>
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
