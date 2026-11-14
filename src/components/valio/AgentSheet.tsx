"use client";

import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/contracts";
import { ApiError } from "@/lib/console/api";
import { eur } from "@/lib/console/format/money";
import { dayAndTime } from "@/lib/console/format/time";
import { firedRules } from "@/lib/insights/rules";
import { supplierApi } from "@/lib/supplier-console/api";
import { callLine, offerNets } from "@/lib/supplier-console/calls";
import { callTime, orderBars, orderCount, plural, recentAsks, statusWord } from "@/lib/supplier-console/format";
import { foldBaskets } from "@/lib/supplier-console/baskets";
import { useAllActivity, useBaskets } from "@/lib/supplier-console/hooks";
import type { ControlAgent } from "@/lib/supplier-console/types";
import { Sheet } from "../ui/Sheet";
import { TechDetails } from "../ui/TechDetails";
import { useNow } from "../ui/useNow";
import { BasketRow } from "./BasketRow";
import { ClientChips, StatusMark } from "./bits";
import { PlainBars } from "./PlainBars";
import { RuleBars } from "./RuleBars";
import { SuspendControl } from "./SuspendControl";
import { agentName, clientName } from "@/lib/supplier-console/names";

interface AgentSheetProps {
  agent?: ControlAgent;
  open: boolean;
  onClose: () => void;
}

type OrdersState = { agentId: string; orders?: Order[]; error?: string };

/** One agent from Valio Aimo's seat: what it asked for, how its orders ended, which rules they hit, and the control to stop it. */
export function AgentSheet({ agent, open, onClose }: AgentSheetProps) {
  const { data: activity } = useAllActivity();
  const { data: baskets } = useBaskets();
  const now = useNow(30_000);
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
        if (cancelled) return;
        // Without a credential the shell explains why; the sheet just shows no rules.
        if (error instanceof ApiError && error.status === 401) setLoaded({ agentId, orders: [] });
        else setLoaded({ agentId, error: error instanceof Error ? error.message : "Orders could not be loaded." });
      });
    return () => {
      cancelled = true;
    };
  }, [open, agentId, buyerId]);

  // A kitchen's multi-line order reads as one event that opens to its lines, not as one row per line.
  const asks = useMemo(() => {
    if (!agentId) return [];
    const own = (baskets ?? []).filter((basket) => basket.buyer.id === buyerId);
    return foldBaskets(recentAsks(activity ?? [], agentId, 60), own).slice(0, 5);
  }, [activity, baskets, agentId, buyerId]);
  const nets = useMemo(() => offerNets(activity ?? []), [activity]);
  const tools = useMemo(
    () => [...new Set((activity ?? []).filter((item) => item.agent.id === agentId && item.tool).map((item) => item.tool))].sort().join(", "),
    [activity, agentId],
  );
  const current = loaded && loaded.agentId === agentId ? loaded : undefined;
  const rules = useMemo(() => (current?.orders ? firedRules(current.orders) : []), [current]);
  const status = agent ? statusWord(agent) : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker={agent?.buyer?.name ?? "Agent"}
      title={agent ? agentName(agent.agent) : "Agent"}
      lede={agent ? `First call ${dayAndTime(agent.firstSeen)} · last call ${dayAndTime(agent.lastSeen)}` : undefined}
    >
      {agent && status ? (
        <div className="agent-sheet">
          <div className="agent-facts">
            <StatusMark agent={agent} />
            <ClientChips clients={agent.clients} max={6} />
          </div>
          <p className="agent-sheet-sum">
            {plural(agent.calls, "call")}, {plural(agent.quotes, "fixed price")} asked.{" "}
            {agent.confirmedNet > 0 ? `${eur(agent.confirmedNet)} bought.` : "Nothing bought yet."}
          </p>

          <section className="sheet-part" aria-labelledby="control-title">
            <h3 id="control-title">Pause</h3>
            <SuspendControl agent={agent} />
          </section>

          <section className="sheet-part" aria-labelledby="asked-title">
            <h3 id="asked-title">Recent asks</h3>
            {asks.length === 0 ? (
              activity ? (
                <p className="sheet-note">Nothing yet.</p>
              ) : (
                <SheetSkeleton />
              )
            ) : (
              <ul className="ask-list">
                  {asks.map((item) =>
                    item.kind === "basket" ? (
                      <BasketRow key={item.basket.id} basket={item.basket} at={item.at} now={now} />
                    ) : (
                      <li key={item.call.id}>
                        <span className="ask-title">{callLine(item.call, nets).sentence}</span>
                        <span className="sub">
                          {callTime(item.call.at, now)}
                          {item.call.client ? ` · ${clientName(item.call.client)}` : ""}
                        </span>
                      </li>
                    ),
                  )}
              </ul>
            )}
          </section>

          <section className="sheet-part" aria-labelledby="outcome-title">
            <h3 id="outcome-title">Orders</h3>
            {orderCount(agent.orders) === 0 ? <p className="sheet-note">No orders yet.</p> : <PlainBars rows={orderBars(agent.orders)} label="This agent's orders by how they ended" />}
          </section>

          {current?.error ? (
            <p className="empty-frame">Could not load this agent&rsquo;s orders: {current.error}</p>
          ) : current?.orders ? (
            <RuleBars rules={rules} title="Held by rules" />
          ) : (
            <SheetSkeleton />
          )}

          <TechDetails
            rows={[
              { label: "Agent id", value: agent.agent.id, mono: true },
              { label: "Buyer id", value: agent.buyer?.id, mono: true },
              { label: "Client labels", value: agent.clients.join(", ") },
              { label: "Tools called", value: tools, mono: true },
            ]}
          />

        </div>
      ) : (
        <p className="sheet-note">This agent is no longer listed.</p>
      )}
    </Sheet>
  );
}

/** Three placeholder lines while a part of the sheet loads. */
function SheetSkeleton() {
  return (
    <div className="sheet-skeleton" aria-busy="true" aria-label="Loading">
      <span className="skeleton" />
      <span className="skeleton" />
      <span className="skeleton" />
    </div>
  );
}
