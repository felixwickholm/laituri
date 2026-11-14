import type { ChainState } from "../types";

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
