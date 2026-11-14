import type { ReactNode } from "react";

/** One part of the limits page: a plain title, at most one short line, then the controls. */
export function LimitsSection({ id, title, line, tour, children }: { id: string; title: string; line?: ReactNode; tour?: string; children: ReactNode }) {
  return (
    <section className="glass pad limits-section" aria-labelledby={`${id}-title`} data-tour={tour}>
      <h2 className="section-title" id={`${id}-title`}>
        {title}
      </h2>
      {line ? <p className="limits-line">{line}</p> : null}
      {children}
    </section>
  );
}

/** A label on the left, its control on the right; stacks on a phone. */
export function LimitsRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="limits-row">
      <div className="limits-row-label">
        <span>{label}</span>
        {hint ? <span className="limits-row-hint">{hint}</span> : null}
      </div>
      <div className="limits-row-control">{children}</div>
    </div>
  );
}
