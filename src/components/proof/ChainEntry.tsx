import { Check, X } from "lucide-react";
import type { ChainState } from "@/lib/console/types";

/** How one entry stands in the chain, read from the browser's check. */
export type LinkState = "verified" | "broken" | "untrusted" | "unknown";

/**
 * The entry that was changed is broken; every entry written after it (a higher sequence number)
 * links back through it, so none of them can be trusted any more. Entries before it still verify.
 */
export function linkState(seq: number, chain: ChainState): LinkState {
  if (chain.state === "verified") return "verified";
  if (chain.state !== "broken") return "unknown";
  if (seq === chain.brokenAt) return "broken";
  return seq > chain.brokenAt ? "untrusted" : "verified";
}

interface ChainEntryProps {
  state: LinkState;
  title: string;
  detail: string;
  time: string;
  dateTime?: string;
  /** A refused attempt: shown in red, though the entry itself verifies. */
  alert?: boolean;
  onOpen?: () => void;
}

/** One link: a seal node on the chain line, a plain title, one line of detail and the time. */
export function ChainEntry({ state, title, detail, time, dateTime, alert, onOpen }: ChainEntryProps) {
  const body = (
    <>
      <span className="chain-seg up" aria-hidden="true" />
      <span className="chain-node" aria-hidden="true">
        {state === "verified" ? <Check /> : state === "broken" ? <X /> : null}
      </span>
      <span className="chain-seg down" aria-hidden="true" />
      <span className="audit-title">{title}</span>
      <time className="mono" dateTime={dateTime}>
        {time}
      </time>
      <span className="sentence">{detail}</span>
      <span className="sr-only">{state === "broken" ? "Changed after it was written." : state === "untrusted" ? "Can no longer be trusted." : ""}</span>
    </>
  );
  return (
    <li className="chain-item" data-link={state} data-alert={alert}>
      {onOpen ? (
        <button type="button" className="audit" onClick={onOpen}>
          {body}
        </button>
      ) : (
        <div className="audit">{body}</div>
      )}
    </li>
  );
}
