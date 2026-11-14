"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, X } from "lucide-react";
import type { StepCopy } from "@/lib/tour/steps";

export interface TourCardProps {
  index: number;
  total: number;
  copy: StepCopy;
  /** Replaces the detail line when the step's outcome did not arrive in time. */
  note?: string;
  nextLabel: string;
  busy: boolean;
  canNext: boolean;
  canBack: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}

/** The walkthrough's voice: where we are, one sentence, at most one more line, and the way on. */
export function TourCard({ index, total, copy, note, nextLabel, busy, canNext, canBack, onNext, onBack, onClose }: TourCardProps) {
  const detail = note ?? copy.detail;
  return (
    <section className="tour-card" aria-labelledby="tour-title" aria-describedby={detail ? "tour-detail" : undefined}>
      <header className="tour-card-top">
        <p className="tour-count">
          Step {index + 1} of {total}
        </p>
        <button type="button" className="icon-btn tour-close" onClick={onClose} aria-label="Close the tour">
          <X aria-hidden="true" />
        </button>
      </header>
      <ol className="tour-progress" aria-hidden="true">
        {Array.from({ length: total }, (_, item) => (
          <li key={item} data-state={item < index ? "done" : item === index ? "now" : "next"} />
        ))}
      </ol>
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
        <p className="tour-keys">Arrow keys work too.</p>
        <button type="button" className="btn btn-secondary big tour-back" onClick={onBack} disabled={!canBack}>
          <ArrowLeft aria-hidden="true" />
          Back
        </button>
        <button type="button" className="btn btn-primary big tour-next" onClick={onNext} aria-disabled={!canNext} data-busy={busy} data-tour-next>
          {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
          {nextLabel}
          {busy ? null : <ArrowRight aria-hidden="true" />}
        </button>
      </footer>
    </section>
  );
}
