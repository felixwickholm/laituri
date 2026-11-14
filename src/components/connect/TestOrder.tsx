"use client";

import { Check, Clock, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AnswerTone } from "@/lib/connect/answers";
import { keyFor } from "@/lib/connect/keys";
import { TEST_NEED } from "@/lib/connect/requests";
import { FLOW_STEPS, flowRequest, previewBody, readStep, type FlowState, type FlowStepId } from "@/lib/connect/test-flow";
import { useWorkspace } from "@/lib/console/workspace-store";

type Phase = "idle" | "running" | "done" | "failed";

interface Line {
  step: FlowStepId;
  request: string;
  body?: string;
  status?: number;
  tone?: AnswerTone;
  summary?: string;
}

const TONE_ICON = {
  ok: { Icon: Check, label: "Succeeded" },
  waiting: { Icon: Clock, label: "Waiting for a person" },
  blocked: { Icon: X, label: "Blocked" },
  error: { Icon: X, label: "Failed" },
} satisfies Record<AnswerTone, { Icon: typeof Check; label: string }>;

const STEP_STATE: Record<AnswerTone, "done" | "waiting" | "failed"> = { ok: "done", waiting: "waiting", blocked: "failed", error: "failed" };

/** Each step stays on screen at least this long so a person can follow it. */
const MIN_STEP_MS = 650;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs the documented HTTP flow from this browser, with this visitor's own agent key, exactly as an outside agent would. */
export function TestOrder({ deliverBy, primaryBuyerId }: { deliverBy: string; primaryBuyerId: string }) {
  const info = useWorkspace();
  const key = keyFor(info, primaryBuyerId);
  const buyer = info?.agentKeys.find((entry) => entry.buyer.id === primaryBuyerId)?.buyer.name ?? "the demo buyer";
  const where = info?.kind === "shared" ? "the shared workspace" : "your own demo workspace";
  const [lines, setLines] = useState<Line[]>([]);
  const [active, setActive] = useState(-1);
  const [phase, setPhase] = useState<Phase>("idle");
  const run = useRef(0);

  useEffect(
    () => () => {
      run.current += 1;
    },
    [],
  );

  async function start() {
    const id = ++run.current;
    const state: FlowState = { key, deliverBy, idempotencyKey: `connect-test-${crypto.randomUUID()}` };
    setLines([]);
    setPhase("running");
    for (const [index, step] of FLOW_STEPS.entries()) {
      if (run.current !== id) return;
      setActive(index);
      const request = flowRequest(step.id, state);
      setLines((shown) => [...shown, { step: step.id, request: `${request.method} ${request.path}`, body: previewBody(request.body) }]);
      const [result] = await Promise.all([send(request), wait(MIN_STEP_MS)]);
      if (run.current !== id) return;
      const read = readStep(step.id, result.status, result.body);
      Object.assign(state, read.carry);
      setLines((shown) => shown.map((line) => (line.step === step.id ? { ...line, status: result.status, tone: read.tone, summary: read.summary } : line)));
      if (!read.ok) {
        setPhase("failed");
        return;
      }
    }
    setActive(FLOW_STEPS.length);
    setPhase("done");
  }

  const stepState = (index: number) => {
    const tone = lines[index]?.tone;
    if (tone) return STEP_STATE[tone];
    if (index === active && phase === "running") return "active";
    return "todo";
  };

  return (
    <section className="cx-test" aria-labelledby="cx-test-title">
      <div className="cx-test-side">
        <h2 id="cx-test-title">No agent at hand?</h2>
        <p className="cx-sub">This browser runs the same four HTTP calls an agent makes, with your agent key. They show up under Connected right now.</p>
        <p className="cx-sub cx-test-real">
          It is a real order for {TEST_NEED.amount} litres, placed inside the mandate {buyer} signed, in {where}.
        </p>
        <ol className="cx-stepper">
          {FLOW_STEPS.map((step, index) => (
            <li key={step.id} data-state={stepState(index)}>
              <span className="cx-stepper-mark" aria-hidden="true">
                <StepMark state={stepState(index)} number={index + 1} />
              </span>
              <span>{step.label}</span>
              <span className="cx-stepper-bar" aria-hidden="true" />
            </li>
          ))}
        </ol>
        <div className="cx-test-actions">
          {phase === "idle" ? (
            <button type="button" className="cx-btn" onClick={start}>
              Send a test order from this browser
            </button>
          ) : (
            <button type="button" className="cx-link" onClick={start} disabled={phase === "running"}>
              <RotateCcw aria-hidden="true" />
              Replay
            </button>
          )}
        </div>
      </div>
      <div className="cx-term" role="log" aria-live="polite" aria-label="Requests and responses">
        {lines.length === 0 ? (
          <div className="cx-term-idle mono">
            <p>Requests and responses appear here:</p>
            {FLOW_STEPS.map((step) => {
              const request = flowRequest(step.id, { key, deliverBy, idempotencyKey: "" });
              return (
                <p key={step.id}>
                  $ {request.method} {request.path}
                </p>
              );
            })}
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.step} className="cx-term-step mono">
              <p className="cx-term-req">
                <span aria-hidden="true">$ </span>
                {line.request}
              </p>
              {line.body && <p className="cx-term-body">{line.body}</p>}
              {line.status === undefined ? (
                <p className="cx-term-wait">waiting…</p>
              ) : (
                <TermResult tone={line.tone ?? "error"} status={line.status} summary={line.summary ?? ""} />
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function StepMark({ state, number }: { state: string; number: number }) {
  if (state === "done") return <Check />;
  if (state === "waiting") return <Clock />;
  if (state === "failed") return <X />;
  return number;
}

function TermResult({ tone, status, summary }: { tone: AnswerTone; status: number; summary: string }) {
  const { Icon, label } = TONE_ICON[tone];
  return (
    <p className="cx-term-res" data-tone={tone}>
      <Icon aria-label={label} />
      <span>
        {status} · {summary}
      </span>
    </p>
  );
}

async function send(request: ReturnType<typeof flowRequest>): Promise<{ status: number; body: Record<string, unknown> | null }> {
  try {
    const response = await fetch(request.path, {
      method: request.method,
      headers: request.headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: response.status, body };
  } catch {
    return { status: 0, body: { detail: "The request did not reach the server." } };
  }
}
