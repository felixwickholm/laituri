"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { latestCalls, liveStatus, mergeCalls, timeAgo, type CallRecord } from "@/lib/connect/activity";
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

const HEALTH = "/api/v1/health";

/** One health check when the page opens, so the card can say at once that the server is ready. */
function useServer(): "checking" | "online" | "offline" {
  const [server, setServer] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    let stopped = false;
    fetch(HEALTH, { cache: "no-store" })
      .then((response) => !stopped && setServer(response.ok ? "online" : "offline"))
      .catch(() => !stopped && setServer("offline"));
    return () => {
      stopped = true;
    };
  }, []);
  return server;
}

/** Polls the public activity feed every 2 s so a call from someone's own agent shows up here. */
export function LiveCalls() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const server = useServer();
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

  const status = liveStatus(server, calls, now);

  return (
    <section className="cx-live" aria-labelledby="cx-live-title">
      <div className="cx-live-head">
        <h2 id="cx-live-title">Connected right now</h2>
        <span className="state" data-tone={status.tone === "neutral" ? undefined : status.tone}>
          <span className="cx-live-dot" data-tone={status.tone} data-pulse={fresh.size > 0 ? "" : undefined} key={[...fresh].join()} aria-hidden="true" />
          {status.word}
        </span>
      </div>
      <p className="cx-live-status" data-tone={status.tone} aria-live="polite">
        {status.tone === "success" && <Check aria-hidden="true" />}
        {status.line}
      </p>
      {calls.length === 0 ? (
        <p className="cx-empty">Paste the command into your agent, or send a test order below. Calls show up here within 2 seconds.</p>
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
