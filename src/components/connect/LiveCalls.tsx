"use client";

import { useEffect, useRef, useState } from "react";
import { latestCalls, mergeCalls, timeAgo, type CallRecord } from "@/lib/connect/activity";
import { PATHS } from "@/lib/connect/requests";
import { useNow } from "../ui/useNow";

const POLL_MS = 2000;
const SHOWN = 6;

const STATUS_WORDS: Record<CallRecord["status"], string> = {
  ok: "OK",
  waiting: "Waiting",
  blocked: "Blocked",
  error: "Error",
};

/** Polls the public activity feed every 2 s so a call from someone's own agent shows up here. */
export function LiveCalls() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const cursor = useRef<string | undefined>(undefined);
  const now = useNow(1000);

  useEffect(() => {
    let stopped = false;
    let first = true;
    async function poll() {
      if (document.hidden) return;
      try {
        const url = cursor.current ? `${PATHS.activity}?after=${encodeURIComponent(cursor.current)}` : PATHS.activity;
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const { activity } = (await response.json()) as { activity: CallRecord[] };
        if (activity.length) cursor.current = activity[activity.length - 1].id;
        const incoming = latestCalls(activity, SHOWN);
        if (incoming.length) {
          setCalls((shown) => mergeCalls(shown, incoming, SHOWN));
          if (!first) setFresh(new Set(incoming.map((call) => call.id)));
        }
        first = false;
        setLoaded(true);
      } catch {
        return;
      }
    }
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="cx-live" aria-labelledby="cx-live-title">
      <div className="cx-live-head">
        <h2 id="cx-live-title">Connected right now</h2>
        <span className="cx-live-dot" data-pulse={fresh.size > 0 ? "" : undefined} key={[...fresh].join()} aria-hidden="true" />
      </div>
      <p className="cx-sub">The latest calls from agents outside this page, checked every 2 seconds.</p>
      {calls.length === 0 ? (
        <p className="cx-empty" aria-live="polite">
          {loaded ? "Waiting for the first call. Paste the command above into your agent." : "Checking for calls…"}
        </p>
      ) : (
        <ol className="cx-calls" aria-live="polite">
          {calls.map((call) => (
              <li key={call.id} className="cx-call" data-fresh={fresh.has(call.id) ? "" : undefined}>
                <span className="cx-call-agent">{call.agent.name}</span>
                <span className="cx-call-tool">
                  <span className="mono">{call.tool}</span>
                  {call.client && <span className="cx-call-client"> via {call.client}</span>}
                </span>
                <span className="cx-call-time">{timeAgo(call.at, now)}</span>
                <span className="cx-status" data-status={call.status}>
                  {STATUS_WORDS[call.status]}
                </span>
              </li>
          ))}
        </ol>
      )}
    </section>
  );
}
