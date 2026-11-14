"use client";

import { useState } from "react";
import type { Order } from "@/lib/contracts";
import { APPROVAL_BLOCKED, ApiError } from "@/lib/console/api";
import { stoppedApproval } from "@/lib/console/format/approval";
import { eur } from "@/lib/console/format/money";
import { isSeeded } from "@/lib/console/format/orders";
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
import { useAnyOrder } from "./useAnyOrder";
import { useOrderProof } from "./useOrderProof";

export function OrderSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const snapshot = useConsole();
  const { orders, jwks, audit, chain } = snapshot;
  const paused = chain.state === "broken";
  const { order, mandate, own, loading } = useAnyOrder(orderId, orders, audit, snapshot.mandate);
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
      const stopped = error instanceof ApiError && error.code === APPROVAL_BLOCKED ? stoppedApproval(error.body) : undefined;
      if (stopped && error instanceof ApiError) {
        consoleStore.apply((error.body as { order: Order }).order);
        toast(stopped.alternatives.length ? `${stopped.reason} Valio Aimo signed ${stopped.alternatives.length === 1 ? "an alternative" : `${stopped.alternatives.length} alternatives`}.` : stopped.reason, "danger");
        return;
      }
      toast(pausedMessage(error) ?? (error instanceof Error ? error.message : "The decision was not saved."), "danger");
    } finally {
      setBusy(false);
    }
  }

  const pending = own && order?.status === "pending_approval";
  const approver = mandate?.mandate.approval.approver.name ?? "the approver";
  return (
    <Sheet
      open={Boolean(orderId)}
      onClose={onClose}
      kicker={order && isSeeded(order) ? "Simulated order · demo history" : "Simulated order"}
      title={order ? `${order.buyer.name} · ${eur(order.offer.totals.net.amount)} net` : "Order"}
      lede={order ? `Placed by ${order.agent.name} · ${dayAndTime(order.createdAt)}` : undefined}
      footer={
        pending ? (
          <>
            <span className="note">{paused ? PAUSED_NOTE : `Your decision is signed as ${shortName(approver)}.`}</span>
            <span className="end">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={(event) => decide("rejected", event.currentTarget)}>
                Reject
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-paused={paused}
                disabled={busy || paused}
                onClick={(event) => decide("approved", event.currentTarget)}
              >
                {paused ? PAUSED_LABEL : "Approve"}
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
        <p className="pane-empty">{loading ? "Loading the order…" : "This order is not in the list any more. It may have been cleared by a reset."}</p>
      )}
    </Sheet>
  );
}
