import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import type { ChainState } from "@/lib/console/types";

function entries(count: number): string {
  return count === 1 ? "1 entry" : `${count} entries`;
}

/** The chain state, computed in this browser. */
export function ChainBadge({ chain, lastSeq }: { chain: ChainState; lastSeq: number }) {
  switch (chain.state) {
    case "verified":
      return (
        <span className="chain-badge" data-state="verified">
          <CircleCheck aria-hidden="true" />
          Verified · {entries(chain.entries)}
        </span>
      );
    case "broken":
      return (
        <span className="chain-badge" data-state="broken" title={chain.reason}>
          <CircleX aria-hidden="true" />
          {chain.brokenAt > lastSeq ? "Newest entries missing" : `Broken at entry ${chain.brokenAt}`}
        </span>
      );
    case "checking":
      return (
        <span className="chain-badge">
          <LoaderCircle aria-hidden="true" />
          Checking {entries(chain.entries)}
        </span>
      );
    default:
      return <span className="chain-badge">No entries yet</span>;
  }
}
