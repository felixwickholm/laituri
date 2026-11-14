"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { runOutcome, runTitle, type RunContext } from "@/lib/console/format/run-view";
import { plainSentence } from "@/lib/console/format/sentence";
import { hourMinute } from "@/lib/console/format/time";
import type { RunBlock as Run } from "@/lib/console/runs";
import { StateWord } from "../ui/StateWord";
import { Attempts } from "./Attempts";
import { ToolRows } from "./ToolRows";

const stagger = (index: number): CSSProperties => ({ ["--i" as string]: Math.min(index, 5) });

interface RunBlockProps {
  run: Run;
  ctx: RunContext;
  onOpenOrder: (orderId: string) => void;
}

/** One buyer request: the request as the title, one outcome line, the agent's own steps in order. */
export function RunBlock({ run, ctx, onOpenOrder }: RunBlockProps) {
  const [open, setOpen] = useState<boolean | null>(null);
  const showTools = open ?? ctx.active;
  const outcome = runOutcome(run, ctx);
  const lastStep = useRef<HTMLLIElement>(null);
  const orderId = run.kind === "attempts" ? undefined : run.orderIds[run.orderIds.length - 1];
  const stepCount = run.steps.length + run.attempts.length;

  useEffect(() => {
    if (!ctx.active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastStep.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [ctx.active, stepCount, showTools]);

  return (
    <article className="run" data-active={ctx.active} aria-label={runTitle(run, ctx)}>
      <header className="run-head">
        <h3 className="run-title" title={runTitle(run, ctx)}>
          {runTitle(run, ctx)}
        </h3>
        <time className="run-time mono" dateTime={run.startedAt}>
          {hourMinute(run.startedAt)}
        </time>
        <p className="run-outcome">
          <StateWord word={outcome.word} tone={outcome.tone} />
          {outcome.detail ? <span className="run-detail">{outcome.detail}</span> : null}
          {orderId ? (
            <button type="button" className="run-open" onClick={() => onOpenOrder(orderId)}>
              Order
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}
        </p>
      </header>
      {run.kind === "attempts" ? (
        <Attempts attempts={run.attempts} showTools={showTools} onOpenOrder={onOpenOrder} lastRef={lastStep} />
      ) : (
        <ol className="steps">
          {run.steps.map((step, index) => (
            <li
              key={step.id}
              ref={index === run.steps.length - 1 ? lastStep : undefined}
              className="step"
              data-status={step.status}
              style={stagger(index)}
            >
              <span className="step-text">{plainSentence(step.text)}</span>
              {showTools ? <ToolRows tools={step.tools} /> : null}
            </li>
          ))}
        </ol>
      )}
      {run.toolCount > 0 ? (
        <button type="button" className="run-calls" aria-expanded={showTools} onClick={() => setOpen(!showTools)}>
          <ChevronRight aria-hidden="true" />
          {run.toolCount === 1 ? "1 call" : `${run.toolCount} calls`} to Laituri
        </button>
      ) : null}
    </article>
  );
}

