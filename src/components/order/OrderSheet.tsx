"use client";

import { useState } from "react";
import { eur } from "@/lib/console/format/money";
import { blockedLine, shortName } from "@/lib/console/format/rules";
import { dayAndTime } from "@/lib/console/format/time";
import { PAUSED_LABEL, PAUSED_NOTE, pausedMessage } from "@/lib/console/paused";
import { consoleStore, useConsole } from "@/lib/console/store";
import { withApprover } from "../session/gate";
import { CopyButton } from "../ui/CopyButton";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/toast";
import { Alternatives } from "./Alternatives";
import { ChecksList } from "./ChecksList";
import { LineItems } from "./LineItems";
import { RequestProof } from "./RequestProof";
import { Signatures } from "./Signatures";
import { Stepper } from "./Stepper";
import { useOrderProof } from "./useOrderProof";

export function OrderSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { orders, jwks, mandate, audit, chain } = useConsole();
  const paused = chain.state === "broken";
  const order = orders.find((item) => item.id === orderId);
  const proof = useOrderProof(order, jwks, mandate, audit);
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected", anchor: HTMLElement) {
    if (!order) return;
    setBusy(true);
    try {
      const decided = await withApprover(anchor, () => consoleStore.decide(order, { decision }));
      if (decided) {
        consoleStore.apply(decided);
        const who = decided.approval ? shortName(decided.approval.decidedBy.name) : "the approver";
        toast(decided.status === "confirmed" ? `Approved. Signed by ${who}.` : `Rejected. Signed by ${who}.`, decided.status === "confirmed" ? "success" : "neutral");
      }
    } catch (error) {
      toast(pausedMessage(error) ?? (error instanceof Error ? error.message : "The decision was not saved."), "danger");
    } finally {
      setBusy(false);
    }
  }

  const pending = order?.status === "pending_approval";
  const approver = mandate?.mandate.approval.approver.name ?? "the approver";
  return (
    <Sheet
      open={Boolean(orderId)}
      onClose={onClose}
      kicker="Simulated order"
      title={order ? `${order.buyer.name} · ${eur(order.offer.totals.net.amount)}` : "Order"}
      lede={order ? `Placed by ${order.agent.name} · ${dayAndTime(order.createdAt)}` : undefined}
      footer={
        pending ? (
          <>
            <span className="note">{paused ? PAUSED_NOTE : `Your decision is signed as ${shortName(approver)}.`}</span>
            <span className="end">
              <button type="button" className="btn" disabled={busy} onClick={(event) => decide("rejected", event.currentTarget)}>
                Reject
              </button>
              <button
                type="button"
                className={`btn ${paused ? "paused" : "btn-primary"}`}
                disabled={busy || paused}
                onClick={(event) => decide("approved", event.currentTarget)}
              >
                {paused ? PAUSED_LABEL : "Approve order"}
              </button>
            </span>
          </>
        ) : undefined
      }
    >
      {order ? (
        <>
          <div className="section">
            <Stepper order={order} />
            {order.status === "blocked" ? <p className="callout tone-danger">{blockedLine(order)}</p> : null}
          </div>
          <RequestProof order={order} />
          <LineItems offer={order.offer} />
          <ChecksList decision={order.decision} />
          <Alternatives order={order} alternatives={proof.alternatives} />
          <Signatures
            rows={proof.signatures}
            offerHash={proof.offerHash}
            simulated={order.simulated}
            buyer={{ name: order.buyer.name, approver: shortName(approver) }}
          />
          <p className="id-line">
            Order ID <span className="mono">{order.id}</span>
            <CopyButton value={order.id} label="Copy order ID" />
          </p>
        </>
      ) : (
        <p className="pane-empty">This order is not in the list any more. It may have been cleared by a reset.</p>
      )}
    </Sheet>
  );
}
