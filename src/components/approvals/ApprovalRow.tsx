"use client";

import { Clock3 } from "lucide-react";
import { useState } from "react";
import type { Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { compareLine } from "@/lib/console/format/proof";
import { askReasons, shortName } from "@/lib/console/format/rules";
import { age } from "@/lib/console/format/time";
import { consoleStore } from "@/lib/console/store";
import { withApprover } from "../session/gate";
import { toast } from "../ui/toast";

interface ApprovalRowProps {
  order: Order;
  now: number;
  onOpen: (orderId: string) => void;
}

const COLLAPSE_MS = 240;

/** One order that waits for a person: who and how much, why, and the two decisions. */
export function ApprovalRow({ order, now, onOpen }: ApprovalRowProps) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const reasons = askReasons(order);

  async function decide(decision: "approved" | "rejected", anchor: HTMLElement) {
    setBusy(decision);
    try {
      const decided = await withApprover(anchor, () => consoleStore.decide(order, { decision }));
      if (!decided) {
        setBusy(null);
        return;
      }
      setLeaving(true);
      await new Promise((resolve) => setTimeout(resolve, COLLAPSE_MS));
      consoleStore.apply(decided);
      const who = decided.approval ? shortName(decided.approval.decidedBy.name) : "the approver";
      if (decided.status === "confirmed") toast(`Approved. Signed by ${who}.`);
      else if (decision === "rejected") toast(`Rejected. Signed by ${who}.`, "neutral");
      else toast("The offer expired before approval. Order not placed.", "danger");
    } catch (error) {
      setBusy(null);
      toast(error instanceof Error ? error.message : "The decision was not saved.", "danger");
    }
  }

  return (
    <li className="approval" data-leaving={leaving}>
      <div>
        <div className="approval-inner">
          <div className="flag">
            <Clock3 width={13} height={13} aria-hidden="true" />
            Needs your approval
          </div>
          <div className="head">
            <span className="who">{order.buyer.name}</span>
            <span className="total">{eur(order.offer.totals.net.amount)}</span>
            <span className="age mono">{age(order.createdAt, now)}</span>
          </div>
          <ul className="reasons">
            {reasons.length > 0 ? reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>A person must decide this order.</li>}
          </ul>
          <p className="compare">{compareLine(order.offer)}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={(event) => decide("approved", event.currentTarget)}>
              {busy === "approved" ? "Signing…" : "Approve order"}
            </button>
            <button type="button" className="btn" disabled={busy !== null} onClick={(event) => decide("rejected", event.currentTarget)}>
              {busy === "rejected" ? "Signing…" : "Reject"}
            </button>
            <button type="button" className="btn btn-quiet details" onClick={() => onOpen(order.id)}>
              Details
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
