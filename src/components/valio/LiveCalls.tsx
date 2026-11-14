"use client";

import { useMemo } from "react";
import { clock } from "@/lib/console/format/time";
import { withEuroSign } from "@/lib/console/format/money";
import { tidyProductText } from "@/lib/console/format/product";
import { ago, liveCalls, toolVerb } from "@/lib/supplier-console/format";
import { useAllActivity } from "@/lib/supplier-console/hooks";
import { DemoTag } from "../ui/DemoTag";

const STATUS_WORD = { ok: "", waiting: "Held", blocked: "Blocked", error: "Failed" } as const;

/** Calls from any buyer's agent as they reach Valio Aimo, newest on top. New rows slide in. */
export function LiveCalls({ now, limit = 6 }: { now: number; limit?: number }) {
  const { data, error } = useAllActivity();
  const calls = useMemo(() => liveCalls([data ?? []], limit), [data, limit]);
  const newest = calls[0];
  const live = newest ? now - Date.parse(newest.at) < 10 * 60 * 1000 : false;

  return (
    <section className="block" aria-labelledby="live-title">
      <header className="block-head">
        <h2 id="live-title">Happening now</h2>
        <span className="block-meta live-meta">
          <span className="live-dot" data-idle={!live} aria-hidden="true" />
          {newest ? `Last call ${ago(newest.at, now)}` : "Waiting for calls"}
        </span>
      </header>
      <div className="card live-card">
        {calls.length === 0 ? (
          <p className="live-empty">{error ? `Could not read agent calls: ${error}` : data ? "No agent has called yet." : "Loading calls…"}</p>
        ) : (
          <ol className="live-list" aria-live="polite" aria-relevant="additions">
            {calls.map((call) => (
              <li key={call.id} className="live-row" data-status={call.status}>
                <span className="live-verb">{toolVerb(call.tool)}</span>
                <span className="live-body">
                  <span className="live-title">{tidyProductText(call.title)}</span>
                  <span className="live-sub">
                    {call.agent.name}
                    {call.buyer ? ` · ${call.buyer.name}` : ""}
                    {call.client ? ` · ${call.client}` : ""}
                    {call.detail ? ` · ${withEuroSign(call.detail)}` : ""}
                  </span>
                </span>
                <span className="live-when">
                  <time dateTime={call.at}>{clock(call.at)}</time>
                  {STATUS_WORD[call.status] ? <span className="live-state">{STATUS_WORD[call.status]}</span> : null}
                  {call.seeded ? <DemoTag /> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
