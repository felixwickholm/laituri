"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Alternative, Order } from "@/lib/contracts";
import { APPROVAL_BLOCKED, ApiError, SIGN_IN_REQUIRED } from "@/lib/console/api";
import { PAUSED_LABEL, PAUSED_NOTE, pausedMessage } from "@/lib/console/paused";
import { consoleStore } from "@/lib/console/store";

type Busy = "approved" | "rejected" | null;

/** A 409 approval_blocked carries the stopped order and the wholesaler's fresh alternatives. */
function stoppedBody(body: unknown): { order: Order; alternatives: Alternative[] } | undefined {
  const value = body as { order?: Order; alternatives?: Alternative[] } | undefined;
  return value?.order ? { order: value.order, alternatives: value.alternatives ?? [] } : undefined;
}

const REASON_MAX = 200;

interface PhoneDecideProps {
  order: Order;
  paused: boolean;
  approver: string;
  /** Signed in through one-click demo access rather than the passcode. */
  demo: boolean;
  /** The re-check at approval stopped the order; these are the wholesaler's fresh alternatives. */
  onStopped: (alternatives: Alternative[]) => void;
}

/** The two choices side by side under the thumb. Reject asks for a short reason, which is signed with it. */
export function PhoneDecide({ order, paused, approver, demo, onStopped }: PhoneDecideProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function decide(decision: "approved" | "rejected", note?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(decision);
    setError(null);
    try {
      consoleStore.apply(await consoleStore.decide(order, { decision, note }));
    } catch (failure) {
      const stopped = failure instanceof ApiError && failure.code === APPROVAL_BLOCKED ? stoppedBody(failure.body) : undefined;
      if (stopped) {
        onStopped(stopped.alternatives);
        consoleStore.apply(stopped.order);
      } else if (failure instanceof ApiError && failure.code === SIGN_IN_REQUIRED) consoleStore.markSignedOut("approver");
      else setError(pausedMessage(failure) ?? (failure instanceof Error ? failure.message : "The decision was not saved."));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  function submitReject(event: FormEvent) {
    event.preventDefault();
    const note = reason.trim();
    if (note) void decide("rejected", note);
  }

  if (rejecting) {
    return (
      <form className="ph-actions" onSubmit={submitReject}>
        <label className="field-label" htmlFor="ph-reason">
          Why are you rejecting it?
        </label>
        <textarea
          id="ph-reason"
          className="text-field ph-reason"
          rows={2}
          maxLength={REASON_MAX}
          placeholder="For example: too much for this week"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          autoFocus
        />
        <div className="ph-pair">
          <button type="button" className="btn big btn-secondary" disabled={busy !== null} onClick={() => setRejecting(false)}>
            Back
          </button>
          <button type="submit" className="btn big ph-danger" disabled={busy !== null || reason.trim() === ""}>
            {busy === "rejected" ? "Signing…" : "Reject and sign"}
          </button>
        </div>
        {error ? (
          <p className="ph-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="ph-actions">
      <div className="ph-pair">
        <button type="button" className="btn big ph-tinted" data-phone-reject disabled={busy !== null} onClick={() => setRejecting(true)}>
          Reject
        </button>
        <button type="button" className="btn big btn-primary" data-phone-approve disabled={busy !== null || paused} onClick={() => void decide("approved")}>
          {paused ? PAUSED_LABEL : busy === "approved" ? "Signing…" : "Approve and sign"}
        </button>
      </div>
      <p className="ph-fine">{paused ? PAUSED_NOTE : `${approver}${demo ? " · demo access" : ""} · your decision is signed and logged`}</p>
      {error ? (
        <p className="ph-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
