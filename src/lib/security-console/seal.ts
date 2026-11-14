import { count } from "@/lib/console/format/money";
import type { ChainState } from "@/lib/console/types";

export interface SealView {
  state: "verified" | "changed" | "checking" | "empty";
  title: string;
  line: string;
}

/**
 * The record's seal in plain words: untouched or changed, checked on this device. When the full replay on this page
 * found a changed entry too, the earlier of the two is named, so the line and the steps below it agree.
 */
export function sealView(chain: ChainState, lastSeq: number, checking: boolean, replayBrokenAt?: number): SealView {
  if (checking || chain.state === "checking") return { state: "checking", title: "Checking…", line: "This device checks every entry now." };
  if (chain.state === "empty") return { state: "empty", title: "Nothing yet", line: "Each step your agent takes is added here." };
  const entries = `${count(chain.entries)} ${chain.entries === 1 ? "entry" : "entries"}`;
  if (chain.state === "verified") return { state: "verified", title: "Untouched", line: `${entries}. Checked on this device.` };
  const brokenAt = replayBrokenAt === undefined ? chain.brokenAt : Math.min(chain.brokenAt, replayBrokenAt);
  const missing = brokenAt > lastSeq;
  return {
    state: "changed",
    title: missing ? "Entries are missing" : "Changed",
    line: missing ? "The newest entries this device saw are gone." : `Entry ${brokenAt} no longer matches its seal.`,
  };
}
