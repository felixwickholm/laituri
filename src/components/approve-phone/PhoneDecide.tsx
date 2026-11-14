"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Order } from "@/lib/contracts";
import { ApiError, SIGN_IN_REQUIRED } from "@/lib/console/api";
import { PAUSED_LABEL, PAUSED_NOTE, pausedMessage } from "@/lib/console/paused";
import { consoleStore } from "@/lib/console/store";

type Busy = "approved" | "rejected" | null;

const REASON_MAX = 200;

/** The two choices, full width under the thumb. Reject asks for a short reason, which is signed with it. */
export function PhoneDecide({ order, paused }: { order: Order; paused: boolean }) {
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
      if (failure instanceof ApiError && failure.code === SIGN_IN_REQUIRED) consoleStore.markSignedOut();
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
        <label className="ph-label" htmlFor="ph-reason">
          Why are you rejecting it?
        </label>
        <textarea
          id="ph-reason"
          className="ph-input ph-reason"
          rows={2}
          maxLength={REASON_MAX}
          placeholder="For example: too much for this week"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          autoFocus
        />
        <button type="submit" className="ph-btn ph-danger" disabled={busy !== null || reason.trim() === ""}>
          {busy === "rejected" ? "Signing…" : "Reject and sign"}
        </button>
        <button type="button" className="ph-btn ph-secondary" disabled={busy !== null} onClick={() => setRejecting(false)}>
          Back
        </button>
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
      <button type="button" className="ph-btn ph-primary" data-phone-approve disabled={busy !== null || paused} onClick={() => void decide("approved")}>
        {paused ? PAUSED_LABEL : busy === "approved" ? "Signing…" : "Approve and sign"}
      </button>
      <button type="button" className="ph-btn ph-secondary" disabled={busy !== null} onClick={() => setRejecting(true)}>
        Reject
      </button>
      {paused ? <p className="ph-note">{PAUSED_NOTE}</p> : <p className="ph-fine">Your decision is signed with your approver key and written to the log.</p>}
      {error ? (
        <p className="ph-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
