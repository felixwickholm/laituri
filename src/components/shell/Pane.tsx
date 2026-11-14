import type { ReactNode } from "react";

interface PaneProps {
  id: string;
  num: number;
  title: string;
  sub: string;
  tools?: ReactNode;
  visible: boolean;
  live?: boolean;
  children: ReactNode;
}

/** One numbered column of the control room, so the pitch can point at 1, 2 and 3. */
export function Pane({ id, num, title, sub, tools, visible, live, children }: PaneProps) {
  const headingId = `${id}-title`;
  return (
    <section className="pane" aria-labelledby={headingId} data-guide={id} data-visible={visible} id={`pane-${id}`}>
      <header className="pane-head">
        <span className="pane-num" aria-hidden="true">
          {num}
        </span>
        <h2 className="pane-title" id={headingId}>
          {title}
        </h2>
        <span className="pane-sub">{sub}</span>
        {tools ? <div className="pane-tools">{tools}</div> : null}
      </header>
      <div className="pane-body" aria-live={live ? "polite" : undefined}>
        {children}
      </div>
    </section>
  );
}
