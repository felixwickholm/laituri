"use client";

import { MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Order } from "@/lib/contracts";
import { APPROVAL_BLOCKED, ApiError } from "@/lib/console/api";
import { stoppedApproval } from "@/lib/console/format/approval";
import { eur } from "@/lib/console/format/money";
import { isSeeded } from "@/lib/console/format/orders";
import { flowSteps, whyThisProduct } from "@/lib/console/format/flow";
import { blockedLine } from "@/lib/console/format/rules";
import { dayAndTime } from "@/lib/console/format/time";
import { PAUSED_LABEL, PAUSED_NOTE, pausedMessage } from "@/lib/console/paused";
import { buildRuns } from "@/lib/console/runs";
import { consoleStore, useConsole } from "@/lib/console/store";
import { askValioAimo } from "../basket/handoff";
import { HandoffSheet } from "../basket/HandoffSheet";
import { withApprover } from "../session/gate";
import { CopyButton } from "../ui/CopyButton";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/toast";
import { Alternatives } from "./Alternatives";
import { ChecksList } from "./ChecksList";
import { LineItems } from "./LineItems";
import { RequestProof } from "./RequestProof";
import { Signatures } from "./Signatures";
import { FlowSteps, WhyProduct } from "./FlowSteps";
import { useAnyOrder } from "./useAnyOrder";
import { useOrderProof } from "./useOrderProof";

export function OrderSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const snapshot = useConsole();
  const { orders, jwks, audit, chain } = snapshot;
  const paused = chain.state === "broken";
  const { order, mandate, own, loading } = useAnyOrder(orderId, orders, audit, snapshot.mandate);
  const proof = useOrderProof(order, jwks, mandate, audit);
  const [busy, setBusy] = useState(false);
  const stepTexts = useMemo(
    () => buildRuns(snapshot.activity, orders).find((run) => orderId && run.orderIds.includes(orderId))?.steps.map((step) => step.text) ?? [],
    [snapshot.activity, orders, orderId],
  );

  async function decide(decision: "approved" | "rejected", anchor: HTMLElement) {
    if (!order) return;
    setBusy(true);
    try {
      const decided = await withApprover(anchor, () => consoleStore.decide(order, { decision }));
      if (decided) {
        consoleStore.apply(decided);
        toast(decided.status === "confirmed" ? "Approved. The order is placed." : "Rejected. Nothing was ordered.", decided.status === "confirmed" ? "success" : "neutral");
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

  function ask() {
    if (!order) return;
    onClose();
    askValioAimo({ orderId: order.id, context: `Order: ${order.offer.intent ?? eur(order.offer.totals.net.amount)}. ${blockedOrState(order)}` });
  }

  const pending = own && order?.status === "pending_approval";
  return (
    <>
    <Sheet
      open={Boolean(orderId)}
      onClose={onClose}
      kicker={order && isSeeded(order) ? "Earlier order" : "Order"}
      title={order ? `${order.buyer.name} · ${eur(order.offer.totals.net.amount)} net` : "Order"}
      lede={order ? `Placed by ${order.agent.name} · ${dayAndTime(order.createdAt)}` : undefined}
      footer={
        pending ? (
          <>
            <span className="note">{paused ? PAUSED_NOTE : "You decide"}</span>
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
          <p className="order-verdict" data-state={order.status === "blocked" || order.refusal ? "danger" : order.status === "pending_approval" ? "warn" : order.status === "confirmed" ? "success" : undefined}>
            {blockedOrState(order)}
          </p>
          <div className="section">
            <FlowSteps steps={flowSteps(order, stepTexts)} />
          </div>
          <WhyProduct lines={whyThisProduct(order, stepTexts)} />
          <RequestProof order={order} />
          <LineItems offer={order.offer} />
          <ChecksList decision={order.decision} />
          <Alternatives order={order} alternatives={proof.alternatives} />
          <Signatures
            rows={proof.signatures}
            offerHash={proof.offerHash}
            buyer={{ name: order.buyer.name, approver: "Purchasing manager" }}
          />
          {own ? (
            <button type="button" className="btn btn-secondary ask-valio" onClick={ask}>
              <MessageCircle aria-hidden="true" />
              Ask Valio Aimo
            </button>
          ) : null}
          <p className="id-line">
            Order ID <span className="mono">{order.id}</span>
            <CopyButton value={order.id} label="Copy order ID" />
          </p>
        </>
      ) : (
        <p className="pane-empty">{loading ? "Loading…" : "Not found. It may have been reset."}</p>
      )}
    </Sheet>
    <HandoffSheet />
    </>
  );
}

/** The order's state in a few words, for the hand-off's context. */
function blockedOrState(order: Order): string {
  if (order.status === "blocked" || order.refusal) return blockedLine(order);
  if (order.status === "pending_approval") return "Needs you.";
  return order.status === "confirmed" ? "Ordered." : "Not ordered.";
}
