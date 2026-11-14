"use client";

import { CirclePlay, X } from "lucide-react";
import { useEffect, useRef } from "react";

/** After Escape: the tour waits here, one press from where it stopped, and keeps the keyboard focus. */
export function ResumePill({ step, total, onResume, onDismiss }: { step: number; total: number; onResume: () => void; onDismiss: () => void }) {
  const resume = useRef<HTMLButtonElement>(null);
  useEffect(() => resume.current?.focus({ preventScroll: true }), []);

  return (
    <div className="tour-resume" role="region" aria-label="Paused tour">
      <button ref={resume} type="button" className="tour-resume-go" onClick={onResume}>
        <CirclePlay aria-hidden="true" />
        Resume the tour
        <span className="tour-resume-step">
          step {step} of {total}
        </span>
      </button>
      <button type="button" className="icon-btn" onClick={onDismiss} aria-label="End the tour">
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
