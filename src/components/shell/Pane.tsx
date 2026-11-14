import type { ReactNode } from "react";

/** Whether the panes can trust an empty list: still loading, the server unreachable, or live. */
export type Feed = "loading" | "offline" | "ok";

const FEED_LINE: Record<Exclude<Feed, "ok">, string> = {
  loading: "Loading…",
  offline: "The server is not reachable. Retrying every second.",
};

/** The empty-state line, unless the feed is not live yet; then it says so instead of claiming "nothing". */
export function EmptyLine({ feed, children }: { feed: Feed; children: ReactNode }) {
  return <p className="pane-empty">{feed === "ok" ? children : FEED_LINE[feed]}</p>;
}

interface PaneProps {
  id: string;
  num: number;
  title: string;
  sub: string;
  visible: boolean;
  live?: boolean;
  alarm?: boolean;
  children: ReactNode;
}

/** One numbered column of the control room, so the pitch can point at 1, 2 and 3. The column itself scrolls. */
export function Pane({ id, num, title, sub, visible, live, alarm, children }: PaneProps) {
  const headingId = `${id}-title`;
  return (
    <section className="pane" aria-labelledby={headingId} data-guide={id} data-visible={visible} data-alarm={alarm} id={`pane-${id}`}>
      <header className="pane-head">
        <span className="pane-num" aria-hidden="true">
          {num}
        </span>
        <h2 className="pane-title" id={headingId}>
          {title}
        </h2>
        <span className="pane-sub">{sub}</span>
      </header>
      <div aria-live={live ? "polite" : undefined}>{children}</div>
    </section>
  );
}
