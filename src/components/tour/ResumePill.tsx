"use client";

import { CirclePlay, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The slots the pages keep empty for the pill, most preferred first: the desktop sidebar, above the phone tab bar, and
 * the landing page's top bar.
 */
const DOCKS = ["side", "phone", "bar"] as const;
type Dock = (typeof DOCKS)[number];
const LOOK_MS = 500;

function shown(element: Element): boolean {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
}

/** The visible dock slot on this page, if the shell has one; followed as the window is resized or the page changes. */
function useDock(): { slot: Element; dock: Dock } | null {
  const [found, setFound] = useState<{ slot: Element; dock: Dock } | null>(null);
  useEffect(() => {
    const look = () => {
      let next: { slot: Element; dock: Dock } | null = null;
      for (const dock of DOCKS) {
        const slot = document.querySelector(`[data-tour-dock="${dock}"]`);
        if (slot && shown(slot)) {
          next = { slot, dock };
          break;
        }
      }
      setFound((current) => (current?.slot === next?.slot ? current : next));
    };
    look();
    const timer = setInterval(look, LOOK_MS);
    window.addEventListener("resize", look);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", look);
    };
  }, []);
  return found;
}

/**
 * After Escape: the tour waits here, one press from where it stopped. It docks in the shell's own slot, so it never
 * covers the page; a page without one keeps it in its bottom-left corner.
 */
export function ResumePill({ step, total, onResume, onDismiss }: { step: number; total: number; onResume: () => void; onDismiss: () => void }) {
  const resume = useRef<HTMLButtonElement>(null);
  const dock = useDock();
  useEffect(() => resume.current?.focus({ preventScroll: true }), []);

  const pill = (
    <div className="tour-resume" role="region" aria-label="Paused walkthrough" data-dock={dock?.dock ?? "float"}>
      <button ref={resume} type="button" className="tour-resume-go" onClick={onResume}>
        <CirclePlay aria-hidden="true" />
        <span className="tour-resume-label">Resume the walkthrough</span>
        <span className="tour-resume-step">
          {step} of {total}
        </span>
      </button>
      <button type="button" className="icon-btn tour-resume-end" onClick={onDismiss} aria-label="End the walkthrough">
        <X aria-hidden="true" />
      </button>
    </div>
  );
  return createPortal(pill, dock?.slot ?? document.body);
}
