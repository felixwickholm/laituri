import { Check, X } from "lucide-react";
import type { Order } from "@/lib/contracts";
import { shortName } from "@/lib/console/format/rules";

type StepState = "done" | "current" | "failed" | "todo";

interface Step {
  label: string;
  state: StepState;
}

/** Requested → Offer signed → Checked against mandate → Approved → Confirmed, read from the order. */
export function stepsFor(order: Order): Step[] {
  const approver = order.approval ? shortName(order.approval.decidedBy.name) : undefined;
  const approvalStep: Step =
    order.status === "blocked"
      ? { label: "Approval", state: "todo" }
      : order.status === "pending_approval"
        ? { label: "Waiting for a person", state: "current" }
        : order.status === "rejected"
          ? { label: approver ? `Rejected by ${approver}` : "Offer expired", state: "failed" }
          : { label: approver ? `Approved by ${approver}` : "Auto-approved", state: "done" };
  return [
    { label: "Requested", state: "done" },
    { label: "Offer signed", state: "done" },
    order.status === "blocked" ? { label: "Blocked by mandate", state: "failed" } : { label: "Checked against mandate", state: "done" },
    approvalStep,
    { label: "Confirmed", state: order.status === "confirmed" ? "done" : "todo" },
  ];
}

export function Stepper({ order }: { order: Order }) {
  const steps = stepsFor(order);
  return (
    <ol className="stepper" aria-label="Order progress">
      {steps.map((step) => (
        <li key={step.label} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
          <span className="dot" aria-hidden="true">
            {step.state === "done" ? <Check /> : step.state === "failed" ? <X /> : null}
          </span>
          <span className="label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
