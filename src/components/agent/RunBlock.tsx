"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { runOutcome, runReason, runTitle, stepText, type RunContext } from "@/lib/console/format/run-view";
import { shortName } from "@/lib/console/format/rules";
import { substitutionTag } from "@/lib/console/format/substitution";
import { duration, feedTime } from "@/lib/console/format/time";
import type { RunBlock as Run, RunStep } from "@/lib/console/runs";
import { StateWord } from "../ui/StateWord";
import { useNow } from "../ui/useNow";
import { TechDetails } from "../ui/TechDetails";
import { Attempts } from "./Attempts";
import { RuleChecks } from "./RuleChecks";

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

/** "search_catalog ×2 · request_quote · place_order": the raw calls behind a run, for the technical details. */
function callTally(tools: { tool?: string }[]): string {
  const tally = new Map<string, number>();
  for (const { tool } of tools) if (tool) tally.set(tool, (tally.get(tool) ?? 0) + 1);
  return [...tally].map(([tool, n]) => (n > 1 ? `${tool} ×${n}` : tool)).join(" · ");
}

interface RunBlockProps {
  run: Run;
  ctx: RunContext;
  newest: boolean;
  /** The id of the demo run this browser started that the block belongs to, for the walkthrough to point at. */
  demoRun?: string;
  onOpenOrder: (orderId: string) => void;
}

/** One buyer request: their words, the steps in plain sentences, how it ended and how long it took. */
export function RunBlock({ run, ctx, newest, demoRun, onOpenOrder }: RunBlockProps) {
  const [expandedByUser, setExpanded] = useState<boolean | null>(null);
  const [allSteps, setAllSteps] = useState(false);
  const now = useNow(60_000);
  const expanded = expandedByUser ?? (newest || ctx.active);
  const outcome = runOutcome(run, ctx);
  const title = runTitle(run, ctx);
  const reason = runReason(run, ctx);
  const lastStep = useRef<HTMLLIElement>(null);
  const order = run.kind === "attempts" ? undefined : ctx.orders.get(run.orderIds[run.orderIds.length - 1] ?? "");
  const steps = ctx.active || allSteps ? run.steps : tellingSteps(run.steps);
  const hidden = run.steps.length - steps.length;
  const stepCount = run.steps.length + run.attempts.length;
  const took = Date.parse(run.endedAt) - Date.parse(run.startedAt);
  const bodyId = `run-${run.id}`;
  const swap = substitutionTag(order);
  const calls = callTally([...run.steps.flatMap((step) => step.tools), ...run.attempts.flatMap((attempt) => attempt.tools)]);

  useEffect(() => {
    if (!ctx.active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastStep.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [ctx.active, stepCount]);

  return (
    <article className="run" data-active={ctx.active} data-demo-run={demoRun} data-expanded={expanded} aria-label={title}>
      <button type="button" className="run-head" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(!expanded)}>
        <span className="run-title">{run.kind === "attempts" ? title : `“${title}”`}</span>
        <span className="run-time">
          <time dateTime={run.startedAt}>{feedTime(run.startedAt, now)}</time>
          {ctx.active ? " · working" : ` · took ${duration(took)}`}
        </span>
        <span className="run-outcome">
          <StateWord word={outcome.word} tone={outcome.tone} />
          {swap ? <StateWord word={swap} tone="waiting" /> : null}
          {outcome.detail ? <span className="run-detail">{outcome.detail}</span> : null}
        </span>
        <ChevronDown className="run-chevron" aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="run-body" id={bodyId}>
          {reason ? (
            <p className="run-reason">
              <span className="run-reason-label">Why the alternative</span>
              {reason}
            </p>
          ) : null}
          {run.kind === "attempts" ? (
            <Attempts attempts={run.attempts} onOpenOrder={onOpenOrder} lastRef={lastStep} />
          ) : (
            <ol className="steps">
              {steps.map((step, index) => (
                <li key={step.id} ref={index === steps.length - 1 ? lastStep : undefined} className="step" data-status={step.status}>
                  <span className="step-text">{stepText(step.text)}</span>
                </li>
              ))}
            </ol>
          )}
          {order && order.decision.checks.length > 0 && !ctx.active ? <RuleChecks order={order} approver={shortName(ctx.approver ?? "a person")} /> : null}
          <div className="run-foot">
            {hidden > 0 ? (
              <button type="button" className="text-link" onClick={() => setAllSteps(true)}>
                Show all {run.steps.length} steps
              </button>
            ) : null}
            {order ? (
              <button type="button" className="text-link strong push" onClick={() => onOpenOrder(order.id)}>
                Order details
                <ChevronRight aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <TechDetails
            rows={[
              { label: run.toolCount === 1 ? "1 call" : `${run.toolCount} calls`, value: calls, mono: true },
              { label: "Order", value: run.orderIds.join(", "), mono: true },
              { label: "Run", value: run.runId, mono: true },
            ]}
          />
        </div>
      ) : null}
    </article>
  );
}

