import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** Grey context beside the title: the date, a count, a scope. */
  meta?: ReactNode;
  /** The screen's finding in one line, read before anything else. */
  lede?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, meta, lede, actions }: PageHeaderProps) {
  return (
    <header className="page-head">
      <div className="page-title-row">
        <h1>{title}</h1>
        {meta ? <span className="page-meta">{meta}</span> : null}
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
      {lede ? <div className="page-lede">{lede}</div> : null}
    </header>
  );
}
