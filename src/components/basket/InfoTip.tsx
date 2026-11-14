"use client";

import { Info } from "lucide-react";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useDismiss } from "../ui/useDismiss";

/** A small "i" that opens one or two plain sentences beside it: the assumption behind a number. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <span className="info-tip" ref={ref}>
      <button type="button" className="info-tip-button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Info aria-hidden="true" />
      </button>
      {open ? (
        <span className="info-tip-body" id={id} role="note">
          {children}
        </span>
      ) : null}
    </span>
  );
}
