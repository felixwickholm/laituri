"use client";

import { Radio } from "lucide-react";
import { useMemo } from "react";
import { foldBaskets } from "@/lib/supplier-console/baskets";
import { callLine, offerNets } from "@/lib/supplier-console/calls";
import { ago, callTime, liveCalls } from "@/lib/supplier-console/format";
import { useAllActivity, useBaskets } from "@/lib/supplier-console/hooks";
import { agentName } from "@/lib/supplier-console/names";
import { BasketRow } from "./BasketRow";
import { EmptyState } from "./bits";

/**
 * Calls from any buyer's agent as they reach Valio Aimo, newest on top, each as one short line. A kitchen's
 * multi-line order folds into one row that opens to its lines. New rows slide in.
 */
export function LiveCalls({ now, limit = 7 }: { now: number; limit?: number }) {
  const { data, error, locked } = useAllActivity();
  const { data: baskets } = useBaskets();
  const feed = useMemo(() => foldBaskets(liveCalls([data ?? []], Number.POSITIVE_INFINITY), baskets ?? []).slice(0, limit), [data, baskets, limit]);
  const nets = useMemo(() => offerNets(data ?? []), [data]);
  const newest = feed[0];
  const live = newest ? now - Date.parse(newest.at) < 10 * 60 * 1000 : false;
  if (locked) return null;

  return (
    <section className="block" aria-labelledby="live-title">
      <header className="block-head">
        <h2 id="live-title">Happening now</h2>
        <span className="block-meta live-meta">
          <span className="live-dot" data-idle={!live} aria-hidden="true" />
          {newest ? `Last call ${ago(newest.at, now)}` : "Waiting for calls"}
        </span>
      </header>
      {feed.length === 0 ? (
        <EmptyState
          icon={Radio}
          text={error ? `Could not read agent calls: ${error}` : data ? "No calls yet." : "Loading…"}
          action={data && !error ? { href: "/connect", label: "Connect an agent" } : undefined}
        />
      ) : (
        <div className="card live-card">
          <ol className="live-list" aria-live="polite" aria-relevant="additions">
            {feed.map((item) => {
              if (item.kind === "basket") return <BasketRow key={item.basket.id} basket={item.basket} at={item.at} now={now} />;
              const call = item.call;
              const line = callLine(call, nets);
              return (
                <li key={call.id} className="live-row" data-tone={line.tone}>
                  <span className="live-body">
                    <span className="live-title">{line.sentence}</span>
                    <span className="live-sub">
                      <span>{agentName(call.agent)}</span>
                      {call.buyer ? <span>{call.buyer.name}</span> : null}
                    </span>
                  </span>
                  <time className="live-when" dateTime={call.at}>
                    {callTime(call.at, now)}
                  </time>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
