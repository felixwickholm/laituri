"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { runOutcome, runTitle, type RunContext } from "@/lib/console/format/run-view";
import { plainSentence } from "@/lib/console/format/sentence";
import { duration, hourMinute } from "@/lib/console/format/time";
import type { RunBlock as Run, RunStep } from "@/lib/console/runs";
import { DemoTag } from "../ui/DemoTag";
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
  seeded: boolean;
  onOpenOrder: (orderId: string) => void;
}

/** One buyer request: their words, the steps in plain sentences, how it ended and how long it took. */
export function RunBlock({ run, ctx, newest, seeded, onOpenOrder }: RunBlockProps) {
  const [expandedByUser, setExpanded] = useState<boolean | null>(null);
  const [allSteps, setAllSteps] = useState(false);
  const [toolsByUser, setTools] = useState<boolean | null>(null);
  const expanded = expandedByUser ?? (newest || ctx.active);
  const showTools = toolsByUser ?? ctx.active;
  const outcome = runOutcome(run, ctx);
  const title = runTitle(run, ctx);
  const lastStep = useRef<HTMLLIElement>(null);
  const order = run.kind === "attempts" ? undefined : ctx.orders.get(run.orderIds[run.orderIds.length - 1] ?? "");
  const steps = ctx.active || allSteps ? run.steps : tellingSteps(run.steps);
  const hidden = run.steps.length - steps.length;
  const stepCount = run.steps.length + run.attempts.length;
  const took = Date.parse(run.endedAt) - Date.parse(run.startedAt);
  const bodyId = `run-${run.id}`;

  useEffect(() => {
    if (!ctx.active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastStep.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [ctx.active, stepCount, showTools]);

  return (
    <article className="run" data-active={ctx.active} data-expanded={expanded} aria-label={title}>
      <button type="button" className="run-head" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(!expanded)}>
        <span className="run-title">{run.kind === "attempts" ? title : `“${title}”`}</span>
        <span className="run-time">
          <time dateTime={run.startedAt}>{hourMinute(run.startedAt)}</time>
          {ctx.active ? " · working" : ` · took ${duration(took)}`}
        </span>
        <span className="run-outcome">
          <StateWord word={outcome.word} tone={outcome.tone} />
          {outcome.detail ? <span className="run-detail">{outcome.detail}</span> : null}
          {seeded ? <DemoTag /> : null}
        </span>
        <ChevronDown className="run-chevron" aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="run-body" id={bodyId}>
          {run.kind === "attempts" ? (
            <Attempts attempts={run.attempts} showTools={showTools} onOpenOrder={onOpenOrder} lastRef={lastStep} />
          ) : (
            <ol className="steps">
              {steps.map((step, index) => (
                <li key={step.id} ref={index === steps.length - 1 ? lastStep : undefined} className="step" data-status={step.status}>
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
              <button type="button" className="text-link strong push" onClick={() => onOpenOrder(order.id)}>
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

