"use client";

import { CircleCheck, CircleX, LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { shortHash } from "@/lib/console/format/activity";
import { count } from "@/lib/console/format/money";
import { clock } from "@/lib/console/format/time";
import { consoleStore } from "@/lib/console/store";
import type { ChainState } from "@/lib/console/types";

/** Long enough that a person sees the check run, short enough not to feel slow. */
const MIN_CHECK_MS = 450;

function headline(chain: ChainState): string {
  switch (chain.state) {
    case "verified":
      return "Verified";
    case "broken":
      return `Broken at entry ${chain.brokenAt}`;
    case "checking":
      return "Checking";
    default:
      return "Nothing logged yet";
  }
}

/** Who reads the log: the buyer in their own console, or Valio Aimo on its side. */
export type LogAudience = "buyer" | "wholesaler";

const WORDS: Record<LogAudience, { checked: string; consequence: string }> = {
  buyer: {
    checked: "checked in your browser with Valio Aimo’s public keys",
    consequence: "Every entry after it can no longer be trusted. Approvals stay paused until the log is restored from the last signed checkpoint.",
  },
  wholesaler: {
    checked: "checked in this browser with Valio Aimo’s public keys",
    consequence: "Valio Aimo treats every later entry as untrusted. Approvals stay paused until the log is restored from the last signed checkpoint.",
  },
};

interface LogHeadProps {
  chain: ChainState;
  lastSeq: number;
  /** Defaults to the buyer, whose console is where the log first appeared. */
  audience?: LogAudience;
}

/** The log's verdict, how it was reached, and a way to run the check again, worded for the side that reads it. */
export function LogHead({ chain, lastSeq, audience = "buyer" }: LogHeadProps) {
  const words = WORDS[audience];
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const entries = chain.state === "empty" ? 0 : chain.entries;
  const missing = chain.state === "broken" && chain.brokenAt > lastSeq;

  async function verifyAgain() {
    setChecking(true);
    const started = performance.now();
    await consoleStore.verifyNow();
    const wait = MIN_CHECK_MS - (performance.now() - started);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    setCheckedAt(clock(new Date().toISOString()));
    setChecking(false);
  }

  const state = checking ? "checking" : chain.state;
  return (
    <div className="log-head" data-state={state} data-tour="log-head">
      <div className="log-verdict">
        <span className="log-icon" aria-hidden="true">
          {state === "verified" ? <CircleCheck /> : state === "broken" ? <CircleX /> : <LoaderCircle className={state === "checking" ? "spin" : undefined} />}
        </span>
        <div>
          <p className="log-title" aria-live="polite">
            {checking ? "Checking every entry…" : missing ? "Entries are missing" : headline(chain)}
          </p>
          <p className="log-sub">
            {count(entries)} {entries === 1 ? "entry" : "entries"} · {words.checked}
            {checkedAt ? ` · last checked ${checkedAt}` : ""}
          </p>
        </div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={verifyAgain} disabled={checking || chain.state === "empty"}>
        <RefreshCw aria-hidden="true" className={checking ? "spin" : undefined} />
        Verify again
      </button>
      {chain.state === "broken" ? (
        <p className="log-alarm" role="alert">
          {missing ? "The newest entries this browser saw are gone." : `Entry ${chain.brokenAt} was changed after it was written.`} {words.consequence}
        </p>
      ) : null}
      <div className="how">
        <p>Each entry carries a fingerprint of the one before it, so changing any entry breaks every link after it.</p>
        <p>
          Valio Aimo signs each entry. Your browser checks every fingerprint and signature against the keys published at{" "}
          <a href="/.well-known/jwks.json" target="_blank" rel="noreferrer">
            /.well-known/jwks.json
          </a>
          , and remembers the newest entry it saw, so a shortened log is noticed too.
        </p>
        {chain.state === "verified" && chain.head ? (
          <p className="how-head">
            Newest entry {lastSeq} · fingerprint <span className="mono">{shortHash(chain.head)}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
