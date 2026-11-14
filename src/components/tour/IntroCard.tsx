"use client";

import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { fillCopy } from "@/lib/tour/copy";
import { INTRO } from "@/lib/tour/steps";
import { Mark } from "../shell/Wordmark";

interface IntroCardProps {
  starting: boolean;
  error?: string;
  steps: number;
  onStart: () => void;
  onClose: () => void;
}

/** The first card: the mark, one line, and one big Start. No sign-in: Start resets this visitor's own copy. */
export function IntroCard({ starting, error, steps, onStart, onClose }: IntroCardProps) {
  const copy = fillCopy(INTRO, { steps }) ?? INTRO;
  return (
    <section className="tour-card tour-intro" aria-labelledby="tour-title" aria-describedby="tour-detail">
      <button type="button" className="icon-btn tour-close" onClick={onClose} aria-label="Close the walkthrough">
        <X aria-hidden="true" />
      </button>
      <Mark size={48} />
      <h2 id="tour-title" className="tour-title tour-title-big">
        {copy.title}
      </h2>
      <p id="tour-detail" className="tour-detail">
        {copy.detail}
      </p>
      <button type="button" className="btn btn-primary big tour-start" onClick={onStart} disabled={starting} data-tour-next>
        {starting ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
        {starting ? "Getting ready…" : "Start"}
        {starting ? null : <ArrowRight aria-hidden="true" />}
      </button>
      {error ? (
        <p className="tour-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
