"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { GUIDE_STEPS, markGuideSeen } from "@/lib/console/guide";

const TIP_WIDTH = 320;
const RING_PAD = 4;

interface Spot {
  ring: { x: number; y: number; w: number; h: number };
  tip: { left: number; top: number };
  arrow?: "up" | "down";
}

function measure(target: string): Spot | undefined {
  const node = document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
  if (!node) return undefined;
  const rect = node.getBoundingClientRect();
  const ring = { x: rect.left - RING_PAD, y: rect.top - RING_PAD, w: rect.width + RING_PAD * 2, h: rect.height + RING_PAD * 2 };
  const width = Math.min(TIP_WIDTH, window.innerWidth - 32);
  const clampX = (x: number) => Math.min(Math.max(16, x), window.innerWidth - width - 16);
  if (rect.height > window.innerHeight * 0.5) {
    // A tall pane: the tip sits inside it, under its header.
    return { ring, tip: { left: clampX(rect.left + 16), top: rect.top + 64 }, arrow: "up" };
  }
  const above = rect.top - 12 - 150;
  if (above > 16) return { ring, tip: { left: clampX(rect.left + rect.width / 2 - width / 2), top: above }, arrow: "down" };
  return { ring, tip: { left: clampX(rect.left), top: rect.bottom + 12 }, arrow: "up" };
}

interface GuideProps {
  open: boolean;
  onClose: () => void;
  onStep: (target: string) => void;
}

/** Four coach marks with a spotlight ring that moves between the dock and the three panes. */
export function Guide({ open, onClose, onStep }: GuideProps) {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | undefined>();
  const step = GUIDE_STEPS[index];

  const finish = useCallback(() => {
    markGuideSeen();
    setIndex(0);
    onClose();
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    onStep(step.target);
    const frame = requestAnimationFrame(() => setSpot(measure(step.target)));
    const onResize = () => setSpot(measure(step.target));
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [open, step, onStep]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") setIndex((current) => (current + 1 < GUIDE_STEPS.length ? current + 1 : current));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open || !spot) return null;
  const last = index === GUIDE_STEPS.length - 1;
  return (
    <>
      <div className="guide-scrim" onClick={finish} aria-hidden="true" />
      <div className="guide-ring" style={{ width: spot.ring.w, height: spot.ring.h, transform: `translate(${spot.ring.x}px, ${spot.ring.y}px)`, left: 0, top: 0 }} aria-hidden="true" />
      <div key={index} className="tip glass" role="dialog" aria-labelledby="tip-title" aria-describedby="tip-body" style={{ left: spot.tip.left, top: spot.tip.top, transformOrigin: spot.arrow === "down" ? "bottom center" : "top left" }}>
        {spot.arrow ? <span className="arrow" data-dir={spot.arrow} aria-hidden="true" /> : null}
        <button type="button" className="icon-btn close" onClick={finish} aria-label="Close the guide">
          <X aria-hidden="true" />
        </button>
        <h2 id="tip-title">{step.title}</h2>
        <p id="tip-body">{step.body}</p>
        <footer>
          <span className="step mono">
            {index + 1}/{GUIDE_STEPS.length}
          </span>
          {index > 0 ? (
            <button type="button" className="btn btn-quiet" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => (last ? finish() : setIndex(index + 1))} autoFocus>
            {last ? "Done" : "Next"}
          </button>
          <span className="keys" aria-hidden="true">
            <span className="kbd">←</span>
            <span className="kbd">→</span>
            <span className="kbd">esc</span>
          </span>
        </footer>
      </div>
    </>
  );
}
