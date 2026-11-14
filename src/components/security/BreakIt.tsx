"use client";

import { LoaderCircle, Play, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "@/lib/console/api";
import { consoleStore, useConsole } from "@/lib/console/store";
import { attemptViews, attemptsBlock, attemptsHeadline, type AttemptView } from "@/lib/security-console/attempts";

type Started = { runId?: string; before?: string };

const STATE_WORD: Record<AttemptView["state"], string> = {
  ready: "Not run",
  next: "Waiting",
  trying: "Checking…",
  stopped: "Stopped",
  through: "Got through",
};

function StateMark({ state }: { state: AttemptView["state"] }) {
  const Icon = state === "stopped" ? ShieldCheck : state === "through" ? ShieldAlert : state === "trying" ? LoaderCircle : null;
  return (
    <span className="sec-state" data-state={state}>
      {Icon ? <Icon aria-hidden="true" className={state === "trying" ? "spin" : undefined} /> : null}
      {STATE_WORD[state]}
    </span>
  );
}

/** The Security verdict: every order is checked; one press shows five unusual actions stopped in the visitor's own copy. */
export function BreakIt() {
  const { activity, orders, run, chain } = useConsole();
  const [started, setStarted] = useState<Started | undefined>();
  const [error, setError] = useState<string | null>(null);
  const block = useMemo(() => attemptsBlock(activity, orders, started), [activity, orders, started]);
  const running = started !== undefined && run?.scenario === "break-mandate" && run.status === "running";
  const views = attemptViews(block, running);
  const headline = attemptsHeadline(views, running);

  async function start() {
    setError(null);
    const before = attemptsBlock(activity, orders)?.id;
    setStarted({ before });
    try {
      const runId = await consoleStore.startRun({ scenario: "break-mandate" });
      setStarted({ runId, before });
    } catch (failure) {
      setStarted(undefined);
      setError(
        failure instanceof ApiError && failure.code === "run_active"
          ? "Another run is going. Try again in a moment."
          : "The test did not start. Try again.",
      );
    }
  }

  return (
    <section className="glass pad sec-verdict" aria-labelledby="sec-title">
      <div className="verdict">
        <p className="verdict-label">Security</p>
        <h2 id="sec-title" className="verdict-title">
          Every order is checked.
        </h2>
        <p className="verdict-line">
          Each order is checked against the customer&rsquo;s limits and Valio Aimo&rsquo;s signed price. If something unusual happens, it is
          stopped, flagged, and a person decides.
        </p>
        <p className="sec-headline" aria-live="polite">
          {headline}
        </p>
        <button type="button" className="btn btn-primary verdict-action" onClick={() => void start()} disabled={running}>
          {running ? <LoaderCircle aria-hidden="true" className="spin" /> : <Play aria-hidden="true" />}
          {running ? "Checking…" : block ? "See it again" : "See unusual actions stopped"}
        </button>
      </div>
      <ol className="sec-list" data-tour="security-attempts">
        {views.map((view) => (
          <li key={view.key} className="sec-row" data-state={view.state}>
            <span className="sec-tried">{view.tried}</span>
            <StateMark state={view.state} />
            <span className="sec-by">
              <span className="sec-by-label">Stopped by:</span>
              {view.stoppedBy}
            </span>
          </li>
        ))}
      </ol>
      {!running && chain.state === "broken" && views.some((view) => view.key === "record" && view.state === "stopped") ? (
        <p className="sec-note">
          One entry was changed on purpose. <a href="#record-title">Put it back.</a>
        </p>
      ) : null}
      {error ? (
        <p className="sec-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
