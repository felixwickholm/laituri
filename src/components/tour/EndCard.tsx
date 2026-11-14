"use client";

import { ArrowRight, X } from "lucide-react";
import { END } from "@/lib/tour/steps";

interface EndCardProps {
  onGo: (href: string) => void;
  onClose: () => void;
}

/** The close, shown once where the tour ended: one line and three big ways on. */
export function EndCard({ onGo, onClose }: EndCardProps) {
  const [first, ...rest] = END.choices;
  return (
    <section className="tour-card tour-end" aria-labelledby="tour-title">
      <button type="button" className="icon-btn tour-close" onClick={onClose} aria-label="Close the walkthrough">
        <X aria-hidden="true" />
      </button>
      <h2 id="tour-title" className="tour-title tour-title-big">
        {END.title}
      </h2>
      <div className="tour-end-actions">
        <button type="button" className="btn btn-primary big" onClick={() => onGo(first.href)} data-tour-next>
          {first.label}
          <ArrowRight aria-hidden="true" />
        </button>
        {rest.map((choice) => (
          <button key={choice.href} type="button" className="btn btn-secondary big" onClick={() => onGo(choice.href)}>
            {choice.label}
          </button>
        ))}
      </div>
    </section>
  );
}
