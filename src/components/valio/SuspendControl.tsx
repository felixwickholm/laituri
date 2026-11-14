"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { AuditEntry } from "@/lib/contracts";
import { clock } from "@/lib/console/format/time";
import { useConsole } from "@/lib/console/store";
import { supplierApi } from "@/lib/supplier-console/api";
import { overviewPoller } from "@/lib/supplier-console/hooks";
import { agentName } from "@/lib/supplier-console/names";
import type { ControlAgent } from "@/lib/supplier-console/types";
import { withOperator } from "../session/gate";

type Step = { kind: "idle" } | { kind: "confirm" } | { kind: "busy" } | { kind: "done"; since: string; suspended: boolean };

/** The signed entry that records this change: the newest suspension or resumption of this agent since `since`. */
function entryFor(audit: AuditEntry[], agentId: string, suspended: boolean, since: string): AuditEntry | undefined {
  const event = suspended ? "agent.suspended" : "agent.resumed";
  for (let i = audit.length - 1; i >= 0; i -= 1) {
    const entry = audit[i];
    if (entry.at < since) break;
    if (entry.event === event && entry.data.agentId === agentId) return entry;
  }
  return undefined;
}

/**
 * Suspends or resumes one agent, as the signed-in Valio Aimo operator: the same gate as the approver's, with
 * one-click demo access first and the passcode second. Suspending asks for a reason first; the change is written
 * to the signed log, and the entry is shown once it arrives.
 */
export function SuspendControl({ agent }: { agent: ControlAgent }) {
  const { audit } = useConsole();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const root = useRef<HTMLDivElement>(null);
  const suspended = agent.status === "suspended";

  async function change(next: boolean) {
    setStep({ kind: "busy" });
    setError(null);
    const since = new Date(Date.now() - 2000).toISOString();
    try {
      const anchor = root.current?.querySelector(next ? ".btn-danger" : ".btn-secondary") ?? root.current;
      const saved = await withOperator(anchor ?? null, () => supplierApi.suspend(agent.agent.id, next, next ? reason.trim() || undefined : undefined));
      if (!saved) {
        setStep(next ? { kind: "confirm" } : { kind: "idle" });
        return;
      }
      setStep({ kind: "done", since, suspended: next });
      setReason("");
      void overviewPoller.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The change was not saved.");
      setStep(next ? { kind: "confirm" } : { kind: "idle" });
    }
  }

  const entry = step.kind === "done" ? entryFor(audit, agent.agent.id, step.suspended, step.since) : undefined;

  return (
    <div className="suspend" data-suspended={suspended} ref={root}>
      {suspended ? (
        <div className="suspend-state" role="status">
          <p className="suspend-title">Suspended{agent.suspendedAt ? ` at ${clock(agent.suspendedAt)}` : ""}</p>
          <p className="suspend-text">
            Valio Aimo refuses this agent&rsquo;s calls until it is resumed.{agent.reason ? ` Reason: ${agent.reason}` : ""}
          </p>
        </div>
      ) : null}

      {step.kind === "confirm" || (step.kind === "busy" && !suspended) ? (
        <form
          className="suspend-form"
          onSubmit={(event) => {
            event.preventDefault();
            void change(true);
          }}
        >
          <label className="field-label" htmlFor={fieldId}>
            Why suspend {agentName(agent.agent)}?
          </label>
          <textarea
            id={fieldId}
            className="text-field text-area"
            rows={3}
            maxLength={300}
            value={reason}
            placeholder="For example: unusual order volume, the buyer asked us to pause it"
            onChange={(event) => setReason(event.target.value)}
            autoFocus
          />
          <p className="suspend-hint">The reason is written to the signed log, where the buyer reads it too.</p>
          <div className="suspend-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep({ kind: "idle" })} disabled={step.kind === "busy"}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={step.kind === "busy" || reason.trim().length === 0}>
              {step.kind === "busy" ? "Suspending…" : "Suspend agent"}
            </button>
          </div>
        </form>
      ) : (
        <div className="suspend-actions">
          {suspended ? (
            <button type="button" className="btn btn-secondary" onClick={() => void change(false)} disabled={step.kind === "busy"}>
              {step.kind === "busy" ? "Resuming…" : "Resume agent"}
            </button>
          ) : (
            <button type="button" className="btn btn-danger-quiet" onClick={() => setStep({ kind: "confirm" })}>
              Suspend agent
            </button>
          )}
        </div>
      )}

      {error ? (
        <p className="suspend-error" role="alert">
          {error}
        </p>
      ) : null}

      {step.kind === "done" ? (
        <div className="signed-entry" role="status">
          <CircleCheck aria-hidden="true" />
          <div>
            <p className="signed-title">
              {step.suspended ? "Suspended" : "Resumed"}. {entry ? `Signed and logged as entry ${entry.seq}.` : "Waiting for the signed log entry…"}
            </p>
            {entry ? (
              <>
                <p className="signed-summary">{entry.summary}</p>
                <p className="signed-meta">
                  {clock(entry.at)} ·{" "}
                  <Link href="/valio/audit" className="text-link">
                    Open the audit log
                  </Link>
                </p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
