"use client";

import { useCallback, useState } from "react";
import { count } from "@/lib/console/format/money";
import { useOverview } from "@/lib/supplier-console/hooks";
import { PageHeader } from "../shell/PageHeader";
import { useNow } from "../ui/useNow";
import { AgentSheet } from "./AgentSheet";
import { AgentsTable } from "./AgentsTable";
import { BlockNote, ControlFoot } from "./bits";
import { OutcomeKey } from "./OutcomeBar";
import { TwoKitchens } from "./TwoKitchens";

/** Every connected agent, what Valio Aimo can and cannot see of it, and the control to stop one. */
export function AgentsScreen({ initialAgent }: { initialAgent?: string }) {
  const { data: overview, error, locked } = useOverview();
  const now = useNow(30_000);
  const [openId, setOpenId] = useState<string | null>(initialAgent ?? null);
  const close = useCallback(() => setOpenId(null), []);
  const agents = overview?.agents ?? [];
  const agent = agents.find((item) => item.agent.id === openId);
  const suspended = agents.filter((item) => item.status === "suspended").length;
  const buyers = new Set(agents.flatMap((item) => (item.buyer ? [item.buyer.id] : []))).size;

  return (
    <div className="page control-page">
      <PageHeader
        title="Agents"
        meta={overview ? `${count(agents.length)} connected · ${count(buyers)} buyers` : undefined}
        lede={
          overview
            ? suspended > 0
              ? `${count(suspended)} suspended. Open an agent to see what it asked for, or to resume it.`
              : "Each buyer brings its own agent. Open one to see what it asked for, how its orders ended, or to suspend it."
            : error
              ? `Could not load the agents: ${error}`
              : "Each buyer brings its own agent."
        }
      />
      {locked ? null : error && !overview ? (
        <BlockNote>The agents could not be loaded. It retries every two seconds.</BlockNote>
      ) : (
        <>
          <AgentsTable agents={overview?.agents} now={now} onOpen={setOpenId} />
          <OutcomeKey />
        </>
      )}
      <section className="sight" aria-labelledby="sight-title">
        <h2 id="sight-title" className="sr-only">
          What this dashboard shows
        </h2>
        <div className="sight-col">
          <h3>The dashboard shows</h3>
          <ul>
            <li>Every request and order that reached Valio Aimo, and the agent and app that sent it.</li>
            <li>Which buyer rule held or stopped an order, by name.</li>
            <li>Every offer Valio Aimo signed, and whether it was used.</li>
          </ul>
        </div>
        <div className="sight-col">
          <h3>The dashboard does not show</h3>
          <ul>
            <li>What sits behind a buyer&rsquo;s rules: its limits, allergen lists and approvers.</li>
          </ul>
          <p className="sight-note">The dashboard does not show a buyer&rsquo;s limits; it shows which rule fired.</p>
        </div>
      </section>
      {locked ? null : <TwoKitchens />}
      <ControlFoot />
      <AgentSheet agent={agent} open={Boolean(openId && agent)} onClose={close} />
    </div>
  );
}
