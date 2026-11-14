"use client";

import { Check, ChevronRight, Clock3, X } from "lucide-react";
import { useRef, useState } from "react";
import type { Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { askedLine, matchedFacts, offeredShort } from "@/lib/console/format/proof";
import { askReasons, shortName } from "@/lib/console/format/rules";
import { age } from "@/lib/console/format/time";
import { consoleStore } from "@/lib/console/store";
import { withApprover } from "../session/gate";
import { CountUp } from "../ui/CountUp";
import { toast } from "../ui/toast";

interface ApprovalRowProps {
  order: Order;
  now: number;
  onOpen: (orderId: string) => void;
}

const COLLAPSE_MS = 240;

/** The money decision: amount, why it stopped, the request against the offer, and the two choices. */
export function ApprovalRow({ order, now, onOpen }: ApprovalRowProps) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const inFlight = useRef(false);
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
      toast(error instanceof Error ? error.message : "The decision was not saved.", "danger");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <li className="approval" data-leaving={leaving}>
      <div>
        <article className="decision" aria-label={`Order ${order.id} waits for your approval`}>
          <div className="flag">
            <Clock3 width={14} height={14} aria-hidden="true" />
            Needs your approval
            <span className="age mono">{age(order.createdAt, now)}</span>
          </div>
          <div className="amount-line">
            <span className="amount">
              <CountUp value={order.offer.totals.net.amount} format={eur} />
            </span>
            <span className="net">net · {order.buyer.name}</span>
          </div>
          <ul className="reasons">
            {reasons.length > 0 ? reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>A person must decide this order.</li>}
          </ul>
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
          <div className="decide">
            <button type="button" className="btn btn-primary big" disabled={busy !== null} onClick={(event) => decide("approved", event.currentTarget)}>
              {busy === "approved" ? "Signing…" : "Approve order"}
            </button>
            <button type="button" className="btn btn-ghost big" disabled={busy !== null} onClick={(event) => decide("rejected", event.currentTarget)}>
              {busy === "rejected" ? "Signing…" : "Reject"}
            </button>
            <button type="button" className="text-link strong details" onClick={() => onOpen(order.id)}>
              Details
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </article>
      </div>
    </li>
  );
}
