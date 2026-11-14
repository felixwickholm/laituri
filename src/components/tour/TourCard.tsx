"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, X } from "lucide-react";
import type { StepCopy } from "@/lib/tour/copy";
import { FLOW, type FlowStage } from "@/lib/tour/steps";

export interface TourCardProps {
  index: number;
  total: number;
  copy: StepCopy;
  /** Replaces the sentence when the step's result did not arrive in time. */
  note?: string;
  /** Where the story is in Valio Aimo's four-word flow, on the steps that show it. */
  flow?: FlowStage;
  /** The product is still working on this step's result: a quiet spinner, never a lock. */
  working: boolean;
  last: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}

/** The walkthrough's voice: where we are, one headline, at most one sentence, and the way on. */
export function TourCard({ index, total, copy, note, flow, working, last, onNext, onBack, onClose }: TourCardProps) {
  const detail = note ?? copy.detail;
  const at = flow ? FLOW.findIndex((stage) => stage.id === flow) : -1;

  return (
    <section className="tour-card" aria-labelledby="tour-title" aria-describedby={detail ? "tour-detail" : undefined}>
      <header className="tour-card-top">
        <p className="tour-count">
          <span className="tour-count-now">{index + 1}</span> of {total}
        </p>
        {at >= 0 ? (
          <ol className="tour-flow" aria-label="Request, Lookup, Order, Approval">
            {FLOW.map((stage, item) => (
              <li key={stage.id} data-state={item < at ? "done" : item === at ? "now" : "next"} aria-current={item === at ? "step" : undefined}>
                {stage.label}
              </li>
            ))}
          </ol>
        ) : null}
        <button type="button" className="icon-btn tour-close" onClick={onClose} aria-label="Close the walkthrough">
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="tour-copy" key={`${index}:${copy.title}`}>
        <h2 id="tour-title" className="tour-title">
          {copy.title}
        </h2>
        {detail ? (
          <p id="tour-detail" className="tour-detail" data-note={note !== undefined}>
            {detail}
          </p>
        ) : null}
      </div>
      <footer className="tour-actions">
        {working ? <LoaderCircle className="spin tour-working" aria-label="Working" /> : null}
        <button type="button" className="btn btn-secondary big tour-back" onClick={onBack} disabled={index === 0}>
          <ArrowLeft aria-hidden="true" />
          Back
        </button>
        <button type="button" className="btn btn-primary big tour-next" onClick={onNext} data-tour-next>
          {last ? "Finish" : "Next"}
          <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}
