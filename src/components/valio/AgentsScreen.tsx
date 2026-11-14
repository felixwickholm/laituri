"use client";

import { useCallback, useState } from "react";
import { count, eur } from "@/lib/console/format/money";
import { orderBars } from "@/lib/supplier-console/format";
import { useOverview } from "@/lib/supplier-console/hooks";
import type { OutcomeCounts } from "@/lib/supplier-console/types";
import { useNow } from "../ui/useNow";
import { AgentSheet } from "./AgentSheet";
import { AgentsTable } from "./AgentsTable";
import { BlockNote, ValioHead } from "./bits";
import { PlainBars } from "./PlainBars";
import { TwoKitchens } from "./TwoKitchens";

/** Every connected agent: one verdict, four counts, the table, what Valio Aimo can see, and the two-customer run. */
export function AgentsScreen({ initialAgent }: { initialAgent?: string }) {
  const { data: overview, error, locked } = useOverview();
  const now = useNow(30_000);
  const [openId, setOpenId] = useState<string | null>(initialAgent ?? null);
  const close = useCallback(() => setOpenId(null), []);
  const agents = overview?.agents ?? [];
  const agent = agents.find((item) => item.agent.id === openId);
  const suspended = agents.filter((item) => item.status === "suspended").length;
  const active = agents.filter((item) => item.status === "active").length;
  const buyers = new Set(agents.flatMap((item) => (item.buyer ? [item.buyer.id] : []))).size;
  const calls = agents.reduce((sum, item) => sum + item.calls, 0);
  const orders = agents.reduce<OutcomeCounts>(
    (sum, item) => ({
      confirmed_auto: sum.confirmed_auto + item.orders.confirmed_auto,
      confirmed_after_approval: sum.confirmed_after_approval + item.orders.confirmed_after_approval,
      waiting: sum.waiting + item.orders.waiting,
      rejected: sum.rejected + item.orders.rejected,
      blocked: sum.blocked + item.orders.blocked,
      refused: sum.refused + item.orders.refused,
    }),
    { confirmed_auto: 0, confirmed_after_approval: 0, waiting: 0, rejected: 0, blocked: 0, refused: 0 },
  );
  const orderRows = orderBars(orders);
  const bought = agents.reduce((cents, item) => cents + Math.round(item.confirmedNet * 100), 0) / 100;
  const title =
    agents.length === 0
      ? "No agent yet."
      : suspended > 0
        ? `${count(suspended)} ${suspended === 1 ? "agent is" : "agents are"} paused.`
        : `${count(agents.length)} ${agents.length === 1 ? "agent buys" : "agents buy"} for ${count(buyers)} ${buyers === 1 ? "customer" : "customers"}.`;

  return (
    <div className="page control-page">
      <ValioHead title="Agents" date={overview ? `${count(agents.length)} connected · ${count(buyers)} ${buyers === 1 ? "customer" : "customers"}` : undefined} />
      {locked ? null : error && !overview ? (
        <BlockNote>The agents could not be loaded. Trying again.</BlockNote>
      ) : (
        <>
          {overview ? (
            <section className="glass pad week-card" aria-labelledby="agents-verdict">
              <div className="verdict">
                <p className="verdict-label">Right now</p>
                <h2 className="verdict-title" id="agents-verdict">
                  {title}
                </h2>
                {suspended > 0 ? <p className="verdict-line">Open one to let it buy again.</p> : null}
              </div>
              <ul className="count-tiles">
                <li className="count-tile" data-tone={active > 0 ? "success" : undefined}>
                  <span className="count-tile-number">{count(active)}</span>
                  <span className="count-tile-word">active</span>
                </li>
                <li className="count-tile" data-tone={suspended > 0 ? "danger" : undefined}>
                  <span className="count-tile-number">{count(suspended)}</span>
                  <span className="count-tile-word">paused</span>
                </li>
                <li className="count-tile">
                  <span className="count-tile-number">{count(calls)}</span>
                  <span className="count-tile-word">calls</span>
                </li>
                <li className="count-tile" data-wide>
                  <span className="count-tile-number" data-long>
                    {eur(bought)}
                  </span>
                  <span className="count-tile-word">bought, net</span>
                </li>
              </ul>
            </section>
          ) : null}
          <AgentsTable agents={overview?.agents} now={now} onOpen={setOpenId} />
          {orderRows.length > 0 ? (
            <section className="block" aria-labelledby="orders-ended-title">
              <header className="block-head">
                <h2 id="orders-ended-title">How orders ended</h2>
              </header>
              <div className="card">
                <PlainBars rows={orderRows} label="Orders by how they ended" />
              </div>
            </section>
          ) : null}
        </>
      )}
      <section className="sight" aria-labelledby="sight-title">
        <h2 id="sight-title" className="sr-only">
          What Valio Aimo sees
        </h2>
        <div className="sight-col">
          <h3>Valio Aimo sees</h3>
          <ul>
            <li>Requests and orders</li>
            <li>Which rule held an order</li>
            <li>Prices it signed</li>
          </ul>
        </div>
        <div className="sight-col">
          <h3>Does not see</h3>
          <ul>
            <li>The customer&rsquo;s limits</li>
            <li>Allergen lists</li>
            <li>Who approves</li>
          </ul>
        </div>
      </section>
      {locked ? null : <TwoKitchens />}
      <AgentSheet agent={agent} open={Boolean(openId && agent)} onClose={close} />
    </div>
  );
}
