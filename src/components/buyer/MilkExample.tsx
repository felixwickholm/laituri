"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { flowSteps, type FlowStep } from "@/lib/console/format/flow";
import { asks, askSentence } from "@/lib/console/format/rules";
import { buildRuns } from "@/lib/console/runs";
import { consoleStore, useConsole } from "@/lib/console/store";
import type { Order } from "@/lib/contracts";
import { FlowSteps } from "../order/FlowSteps";
import { useUi } from "../shell/ui-context";
import { toast } from "../ui/toast";

/** The challenge's own example request, word for word. */
export const MILK_REQUEST = "I need 1,000 litres of lactose-free milk by Monday.";

/** The approval step in the challenge's words: ordered alone inside the limits, or who waits and why. */
function approvalInWords(order: Order, step: FlowStep): FlowStep {
  if (order.status === "confirmed" && !order.approval) return { ...step, sentence: "Inside your limits: ordered alone." };
  if (order.status === "pending_approval") {
    const [first] = asks(order);
    return { ...step, sentence: `Waits for a person: ${first ? askSentence(first) : "outside what your agent may do alone."}` };
  }
  return step;
}

/** One chip that sends the example request to the buyer's agent, then Request, Lookup, Order and Approval from the order it placed. */
export function MilkExample() {
  const snapshot = useConsole();
  const ui = useUi();
  const [runId, setRunId] = useState<string>();
  const [starting, setStarting] = useState(false);
  const run = snapshot.run && snapshot.run.id === runId ? snapshot.run : undefined;
  const orderId = run?.results?.find((result) => result.orderId)?.orderId;
  const order = orderId ? snapshot.orders.find((item) => item.id === orderId) : undefined;
  const stepTexts = useMemo(
    () => (orderId ? (buildRuns(snapshot.activity, snapshot.orders).find((item) => item.orderIds.includes(orderId))?.steps.map((step) => step.text) ?? []) : []),
    [snapshot.activity, snapshot.orders, orderId],
  );
  const working = starting || run?.status === "running";

  async function send() {
    setStarting(true);
    try {
      setRunId(await consoleStore.startRun({ scenario: "milk" }));
    } catch (error) {
      toast(error instanceof Error ? error.message : "The agent could not start.", "danger");
    } finally {
      setStarting(false);
    }
  }

  const steps = order ? flowSteps(order, stepTexts) : undefined;
  return (
    <div className="milk-example">
      <button type="button" className="milk-chip" data-tour="milk-example" onClick={send} disabled={working}>
        <Sparkles aria-hidden="true" />
        <span>{working ? "Your agent is on it…" : `“${MILK_REQUEST}”`}</span>
      </button>
      {steps && order ? (
        <div className="milk-result" aria-live="polite" data-tour="milk-result">
          <FlowSteps steps={steps.map((step) => (step.name === "Approval" ? approvalInWords(order, step) : step))} />
          <button type="button" className="text-link milk-open" onClick={() => ui.openOrder(order.id)}>
            Open the order
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : run?.status === "failed" ? (
        <p className="milk-failed">{run.summary ?? "The agent could not finish. Try again."}</p>
      ) : run?.status === "done" && !orderId ? (
        <p className="milk-failed">{run.summary ?? "No order was placed."}</p>
      ) : null}
    </div>
  );
}
