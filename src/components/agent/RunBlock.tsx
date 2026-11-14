"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { eur } from "@/lib/console/format/money";
import { runOutcome, runTitle, type RunContext } from "@/lib/console/format/run-view";
import { plainSentence } from "@/lib/console/format/sentence";
import { hourMinute } from "@/lib/console/format/time";
import type { RunBlock as Run, RunStep } from "@/lib/console/runs";
import { StateWord } from "../ui/StateWord";
import { Attempts } from "./Attempts";
import { ToolRows } from "./ToolRows";

const TELLING = 4;
/** Notes about an exception: short stock, a skipped product, a counter-offer, a limit. */
const EXCEPTION = /(in stock|alternative|skipped|cut-off|over my limit|substitut|cannot be delivered)/i;

/** The steps that tell the story of a finished run: where it started, anything that stopped or waited, how it ended. */
export function tellingSteps(steps: RunStep[]): RunStep[] {
  if (steps.length <= TELLING) return steps;
  const picks = new Set<RunStep>([steps[0], steps[steps.length - 1]]);
  for (const step of steps) {
    if (picks.size >= TELLING) break;
    if (step.status !== "ok" || EXCEPTION.test(step.text)) picks.add(step);
  }
  for (const step of [...steps].reverse()) {
    if (picks.size >= TELLING) break;
    picks.add(step);
  }
  return steps.filter((step) => picks.has(step));
}

interface RunBlockProps {
  run: Run;
  ctx: RunContext;
  newest: boolean;
  onOpenOrder: (orderId: string) => void;
}

/** One buyer request. Finished runs fold to one row; the newest stays open and shows steps as they arrive. */
export function RunBlock({ run, ctx, newest, onOpenOrder }: RunBlockProps) {
  const [expandedByUser, setExpanded] = useState<boolean | null>(null);
  const [allSteps, setAllSteps] = useState(false);
  const [toolsByUser, setTools] = useState<boolean | null>(null);
  const expanded = run.kind === "attempts" || (expandedByUser ?? newest);
  const showTools = toolsByUser ?? ctx.active;
  const outcome = runOutcome(run, ctx);
  const title = runTitle(run, ctx);
  const lastStep = useRef<HTMLLIElement>(null);
  const order = run.kind === "attempts" ? undefined : ctx.orders.get(run.orderIds[run.orderIds.length - 1] ?? "");
  const steps = ctx.active || allSteps ? run.steps : tellingSteps(run.steps);
  const hidden = run.steps.length - steps.length;
  const stepCount = run.steps.length + run.attempts.length;

  useEffect(() => {
    if (!ctx.active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastStep.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [ctx.active, stepCount, showTools]);

  return (
    <article className="run" data-active={ctx.active} data-expanded={expanded} aria-label={title}>
      <button
        type="button"
        className="run-row"
        aria-expanded={expanded}
        disabled={run.kind === "attempts"}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="run-dot" data-tone={outcome.tone} aria-hidden="true" />
        <span className="run-title" title={title}>
          {title}
        </span>
        <span className="run-amount mono">{order ? eur(order.offer.totals.net.amount) : hourMinute(run.startedAt)}</span>
        <span className="run-meta">
          <StateWord word={outcome.word} tone={outcome.tone} />
          {outcome.detail ? <span className="run-detail">{outcome.detail}</span> : null}
        </span>
        {run.kind === "attempts" ? null : <ChevronDown className="run-chevron" aria-hidden="true" />}
      </button>
      {expanded ? (
        <div className="run-body">
          {run.kind === "attempts" ? (
            <Attempts attempts={run.attempts} showTools={showTools} onOpenOrder={onOpenOrder} lastRef={lastStep} />
          ) : (
            <ol className="steps">
              {steps.map((step, index) => (
                <li key={step.id} ref={index === steps.length - 1 ? lastStep : undefined} className="step" data-status={step.status} style={{ ["--i" as string]: Math.min(index, 5) }}>
                  <span className="step-text">{plainSentence(step.text)}</span>
                  {showTools ? <ToolRows tools={step.tools} /> : null}
                </li>
              ))}
            </ol>
          )}
          <div className="run-foot">
            {hidden > 0 ? (
              <button type="button" className="text-link" onClick={() => setAllSteps(true)}>
                Show all {run.steps.length} steps
              </button>
            ) : null}
            {run.toolCount > 0 ? (
              <button type="button" className="text-link quiet" aria-expanded={showTools} onClick={() => setTools(!showTools)}>
                {showTools ? "Hide" : "Show"} {run.toolCount === 1 ? "1 call" : `${run.toolCount} calls`}
              </button>
            ) : null}
            {order ? (
              <button type="button" className="text-link strong" onClick={() => onOpenOrder(order.id)}>
                Order details
                <ChevronRight aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
