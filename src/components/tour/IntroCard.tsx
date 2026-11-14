"use client";

import { ArrowRight, LoaderCircle, X } from "lucide-react";

const STEP_WORDS: Record<number, string> = { 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten" };

interface IntroCardProps {
  starting: boolean;
  error?: string;
  steps: number;
  onStart: () => void;
  onClose: () => void;
}

/** The first card: what is about to happen, and the honest note on what Start changes. */
export function IntroCard({ starting, error, steps, onStart, onClose }: IntroCardProps) {
  return (
    <section className="tour-card tour-intro" aria-labelledby="tour-title" aria-describedby="tour-detail">
      <button type="button" className="icon-btn tour-close" onClick={onClose} aria-label="Close the tour">
        <X aria-hidden="true" />
      </button>
      <h2 id="tour-title" className="tour-title tour-title-big">
        Watch an AI agent buy from Valio Aimo, inside rules a person signed.
      </h2>
      <p id="tour-detail" className="tour-detail">
        {STEP_WORDS[steps] ?? steps} short steps, about two minutes. You only press Next.
      </p>
      <div className="tour-intro-actions">
        <button type="button" className="btn btn-primary big tour-start" onClick={onStart} disabled={starting} data-tour-next>
          {starting ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
          {starting ? "Getting the demo ready…" : "Start"}
          {starting ? null : <ArrowRight aria-hidden="true" />}
        </button>
        <p className="tour-fine">The scenes are scripted so they run the same every time. This is your own copy of the demo.</p>
      </div>
      {error ? (
        <p className="tour-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
