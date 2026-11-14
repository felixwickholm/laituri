"use client";

import { ArrowLeft, ArrowRight, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { END_LINES } from "@/lib/tour/steps";

interface EndCardProps {
  onGo: (href: string) => void;
  onReset: () => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}

const PLACES = [
  { href: "/buyer", label: "Explore the buyer side" },
  { href: "/valio", label: "Explore Valio Aimo’s side" },
];

/** The close: what was just shown, in three lines tied to the judging criteria, and where to go next. */
export function EndCard({ onGo, onReset, onBack, onClose }: EndCardProps) {
  const [resetting, setResetting] = useState(false);

  async function reset() {
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="tour-card tour-end" aria-labelledby="tour-title">
      <button type="button" className="icon-btn tour-close" onClick={onClose} aria-label="Close the tour">
        <X aria-hidden="true" />
      </button>
      <h2 id="tour-title" className="tour-title tour-title-big">
        That was Laituri.
      </h2>
      <ul className="tour-recap">
        {END_LINES.map((line) => (
          <li key={line.text}>
            <p>{line.text}</p>
            <p className="tour-criteria">{line.criteria}</p>
          </li>
        ))}
      </ul>
      <div className="tour-end-actions">
        <button type="button" className="btn btn-primary big" onClick={() => onGo("/connect")} data-tour-next>
          Connect your own agent
          <ArrowRight aria-hidden="true" />
        </button>
        {PLACES.map((place) => (
          <button key={place.href} type="button" className="btn btn-secondary big" onClick={() => onGo(place.href)}>
            {place.label}
          </button>
        ))}
      </div>
      <div className="tour-end-foot">
        <button type="button" className="text-link tour-end-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Back to the last step
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => void reset()} disabled={resetting}>
          <RotateCcw aria-hidden="true" />
          {resetting ? "Resetting…" : "Reset demo"}
        </button>
      </div>
    </section>
  );
}
