"use client";

import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/contracts";
import { count, eur, withEuroSign } from "@/lib/console/format/money";
import { tidyProductText } from "@/lib/console/format/product";
import { day, dayAndTime } from "@/lib/console/format/time";
import { firedRules } from "@/lib/insights/rules";
import { supplierApi } from "@/lib/supplier-console/api";
import { recentAsks, statusWord } from "@/lib/supplier-console/format";
import { useAllActivity } from "@/lib/supplier-console/hooks";
import type { ControlAgent } from "@/lib/supplier-console/types";
import { Sheet } from "../ui/Sheet";
import { StateWord } from "../ui/StateWord";
import { DemoTag } from "../ui/DemoTag";
import { ClientChips } from "./bits";
import { OutcomeBar } from "./OutcomeBar";
import { RuleBars } from "./RuleBars";
import { SuspendControl } from "./SuspendControl";

interface AgentSheetProps {
  agent?: ControlAgent;
  open: boolean;
  onClose: () => void;
}

type OrdersState = { agentId: string; orders?: Order[]; error?: string };

/** One agent from Valio Aimo's seat: what it asked for, how its orders ended, which rules they hit, and the control to stop it. */
export function AgentSheet({ agent, open, onClose }: AgentSheetProps) {
  const { data: activity } = useAllActivity();
  const [loaded, setLoaded] = useState<OrdersState | null>(null);
  const agentId = agent?.agent.id;
  const buyerId = agent?.buyer?.id;

  useEffect(() => {
    if (!open || !agentId || !buyerId) return;
    let cancelled = false;
    supplierApi
      .orders(buyerId)
      .then((orders) => {
        if (!cancelled) setLoaded({ agentId, orders: orders.filter((order) => order.agent.id === agentId) });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded({ agentId, error: error instanceof Error ? error.message : "Orders could not be loaded." });
      });
    return () => {
      cancelled = true;
    };
  }, [open, agentId, buyerId]);

  const asks = useMemo(() => (agentId ? recentAsks(activity ?? [], agentId, 5) : []), [activity, agentId]);
  const current = loaded && loaded.agentId === agentId ? loaded : undefined;
  const rules = useMemo(() => (current?.orders ? firedRules(current.orders) : []), [current]);
  const status = agent ? statusWord(agent) : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker={agent?.buyer?.name ?? "Agent"}
      title={agent?.agent.name ?? "Agent"}
      lede={agent ? `First seen ${dayAndTime(agent.firstSeen)} · last call ${dayAndTime(agent.lastSeen)}` : undefined}
    >
      {agent && status ? (
        <div className="agent-sheet">
          <div className="agent-facts">
            <StateWord word={status.word} tone={status.tone} />
            <ClientChips clients={agent.clients} max={6} />
          </div>
          <dl className="fact-strip">
            <div>
              <dt>Calls</dt>
              <dd className="num">{count(agent.calls)}</dd>
            </div>
            <div>
              <dt>Quotes</dt>
              <dd className="num">{count(agent.quotes)}</dd>
            </div>
            <div>
              <dt>Confirmed</dt>
              <dd className="num">{eur(agent.confirmedNet)}</dd>
            </div>
          </dl>

          <section className="sheet-part" aria-labelledby="control-title">
            <h3 id="control-title">Control</h3>
            <SuspendControl agent={agent} />
          </section>

          <section className="sheet-part" aria-labelledby="asked-title">
            <h3 id="asked-title">Asked for recently</h3>
            {asks.length === 0 ? (
              <p className="dim">{activity ? "No searches or quotes from this agent yet." : "Loading calls…"}</p>
            ) : (
              <ul className="ask-list">
                {asks.map((ask) => (
                  <li key={ask.id}>
                    <span className="ask-title">{tidyProductText(ask.title)}</span>
                    <span className="sub">
                      {day(ask.at)}
                      {ask.detail ? ` · ${withEuroSign(tidyProductText(ask.detail))}` : ""}
                      {ask.client ? ` · ${ask.client}` : ""}
                      {ask.seeded ? <DemoTag /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sheet-part" aria-labelledby="outcome-title">
            <h3 id="outcome-title">Orders by outcome</h3>
            <OutcomeBar orders={agent.orders} legend />
          </section>

          {current?.error ? (
            <p className="empty-frame">Could not load this agent&rsquo;s orders: {current.error}</p>
          ) : current?.orders ? (
            <RuleBars rules={rules} title="Rules its orders hit" />
          ) : (
            <p className="dim">Loading the rules its orders hit…</p>
          )}

        </div>
      ) : (
        <p className="dim">This agent is no longer listed.</p>
      )}
    </Sheet>
  );
}
