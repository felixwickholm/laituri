"use client";

import { Radio } from "lucide-react";
import { useMemo } from "react";
import { callLine, offerNets } from "@/lib/supplier-console/calls";
import { ago, callTime, liveCalls } from "@/lib/supplier-console/format";
import { useAllActivity } from "@/lib/supplier-console/hooks";
import { agentName } from "@/lib/supplier-console/names";
import { HistoryNote } from "../ui/HistoryNote";
import { EmptyState } from "./bits";

/** Calls from any buyer's agent as they reach Valio Aimo, newest on top, each as one short line. New rows slide in. */
export function LiveCalls({ now, limit = 7 }: { now: number; limit?: number }) {
  const { data, error, locked } = useAllActivity();
  const calls = useMemo(() => liveCalls([data ?? []], limit), [data, limit]);
  const nets = useMemo(() => offerNets(data ?? []), [data]);
  const newest = calls[0];
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
      {calls.length === 0 ? (
        <EmptyState
          icon={Radio}
          text={error ? `Could not read agent calls: ${error}` : data ? "No agent has called yet." : "Loading calls…"}
          action={data && !error ? { href: "/connect", label: "Connect an agent" } : undefined}
        />
      ) : (
        <div className="card live-card">
          <ol className="live-list" aria-live="polite" aria-relevant="additions">
            {calls.map((call) => {
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
          <div className="live-foot">
            <HistoryNote show={calls.some((call) => call.seeded)} />
          </div>
        </div>
      )}
    </section>
  );
}
