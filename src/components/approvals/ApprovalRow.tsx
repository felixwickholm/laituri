"use client";

import { Check, ChevronRight, X } from "lucide-react";
import { useRef, useState } from "react";
import type { Order } from "@/lib/contracts";
import { APPROVAL_BLOCKED, ApiError } from "@/lib/console/api";
import { priceHoldLine, stoppedApproval, type StoppedApproval } from "@/lib/console/format/approval";
import { eur } from "@/lib/console/format/money";
import { askedLine, matchedFacts, offeredShort } from "@/lib/console/format/proof";
import { askReasons, shortName } from "@/lib/console/format/rules";
import { age } from "@/lib/console/format/time";
import { PAUSED_LABEL, PAUSED_NOTE, pausedMessage } from "@/lib/console/paused";
import { consoleStore } from "@/lib/console/store";
import { withApprover } from "../session/gate";
import { CountUp } from "../ui/CountUp";
import { toast } from "../ui/toast";

interface ApprovalRowProps {
  order: Order;
  now: number;
  paused: boolean;
  onOpen: (orderId: string) => void;
}

const COLLAPSE_MS = 240;

/** The money decision: the reason first, the amount large, the request against the offer, then the two choices. */
export function ApprovalRow({ order, now, paused, onOpen }: ApprovalRowProps) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [stopped, setStopped] = useState<{ view: StoppedApproval; order: Order } | null>(null);
  const inFlight = useRef(false);
  const hold = priceHoldLine(order);
  const reasons = askReasons(order);
  const matches = matchedFacts(order).every((fact) => fact.ok);

  async function decide(decision: "approved" | "rejected", anchor: HTMLElement) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(decision);
    try {
      const decided = await withApprover(anchor, () => consoleStore.decide(order, { decision }));
      if (!decided) return;
      setLeaving(true);
      await new Promise((resolve) => setTimeout(resolve, COLLAPSE_MS));
      consoleStore.apply(decided);
      const who = decided.approval ? shortName(decided.approval.decidedBy.name) : "the approver";
      if (decided.status === "confirmed") toast(`Approved. Signed by ${who}.`);
      else if (decision === "rejected") toast(`Rejected. Signed by ${who}.`, "neutral");
      else toast("The offer expired before approval. Order not placed.", "danger");
    } catch (error) {
      const view = error instanceof ApiError && error.code === APPROVAL_BLOCKED ? stoppedApproval(error.body) : undefined;
      if (view && error instanceof ApiError) {
        setStopped({ view, order: (error.body as { order: Order }).order });
        return;
      }
      toast(pausedMessage(error) ?? (error instanceof Error ? error.message : "The decision was not saved."), "danger");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <li className="approval" data-leaving={leaving}>
      <div>
        <article className="decision" aria-label={`Order of ${eur(order.offer.totals.net.amount)} waits for your approval`}>
          <p className="decision-reason">{reasons[0] ?? "A person must decide this order."}</p>
          <div className="decision-amount">
            <span className="amount">
              <CountUp value={order.offer.totals.net.amount} format={eur} />
            </span>
            <span className="net">net</span>
            <span className="age">{hold ?? (age(order.createdAt, now) === "now" ? "just now" : `${age(order.createdAt, now)} ago`)}</span>
          </div>
          {reasons.length > 1 ? (
            <ul className="decision-more">
              {reasons.slice(1).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          <ul className="mini-proof" aria-label="Request versus offer">
            <li>
              <Check aria-hidden="true" />
              <span>{askedLine(order.offer)}</span>
            </li>
            <li data-ok={matches}>
              {matches ? <Check aria-label="Matches the request" /> : <X aria-label="Differs from the request" />}
              <span>{offeredShort(order.offer)}</span>
            </li>
          </ul>
          {stopped ? (
            <div className="decision-stopped" role="alert">
              <p>{stopped.view.reason}</p>
              {stopped.view.alternatives.length > 0 ? (
                <>
                  <p className="decision-stopped-lead">Valio Aimo offers instead, signed:</p>
                  <ul>
                    {stopped.view.alternatives.map((alternative) => (
                      <li key={alternative.id}>
                        <span>{alternative.what}</span>
                        <span className="num">{alternative.net}</span>
                        <span className="sub">{alternative.tradeoff}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={() => consoleStore.apply(stopped.order)}>
                Done
              </button>
            </div>
          ) : (
            <div className="decide">
              <button
                type="button"
                className="btn btn-primary big"
                data-paused={paused}
                disabled={busy !== null || paused}
                onClick={(event) => decide("approved", event.currentTarget)}
              >
                {paused ? PAUSED_LABEL : busy === "approved" ? "Signing…" : "Approve"}
              </button>
              <button type="button" className="btn btn-secondary big" disabled={busy !== null} onClick={(event) => decide("rejected", event.currentTarget)}>
                {busy === "rejected" ? "Signing…" : "Reject"}
              </button>
            </div>
          )}
          {paused ? <p className="paused-note">{PAUSED_NOTE}</p> : null}
          <button type="button" className="text-link strong" onClick={() => onOpen(order.id)}>
            See the full check
            <ChevronRight aria-hidden="true" />
          </button>
        </article>
      </div>
    </li>
  );
}
