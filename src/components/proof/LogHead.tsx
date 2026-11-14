"use client";

import { CircleCheck, CircleX, LoaderCircle, RefreshCw } from "lucide-react";
import type { AuditEntry } from "@/lib/contracts";
import { shortHash } from "@/lib/console/format/activity";
import { count } from "@/lib/console/format/money";
import type { ChainState } from "@/lib/console/types";
import { TechDetails } from "../ui/TechDetails";
import { useVerifyReplay } from "./useVerifyReplay";
import { VerifySteps } from "./VerifySteps";

/** Who reads the log: the buyer in their own console, or Valio Aimo on its side. */
export type LogAudience = "buyer" | "wholesaler";

const CHECKED: Record<LogAudience, string> = {
  buyer: "checked in your browser with Valio Aimo’s public keys",
  wholesaler: "checked in this browser with Valio Aimo’s public keys",
};

export const PAUSED_UNTIL_RESTORED = "Approvals stay paused until the log is restored from the last signed checkpoint.";
export const DISPUTE_LINE = "If a customer disputes an order, both sides check the same record in seconds.";

function headline(chain: ChainState, missing: boolean): string {
  if (chain.state === "verified") return "Verified";
  if (chain.state === "broken") return missing ? "Entries are missing" : `Broken at entry ${chain.brokenAt}`;
  if (chain.state === "checking") return "Checking";
  return "Nothing logged yet";
}

interface LogHeadProps {
  audit: AuditEntry[];
  chain: ChainState;
  /** Defaults to the buyer, whose console is where the log first appeared. */
  audience?: LogAudience;
}

/** The log's seal: the verdict, the browser's check replayed step by step, and a way to run it again. */
export function LogHead({ audit, chain, audience = "buyer" }: LogHeadProps) {
  const { state: replay, replay: verifyAgain } = useVerifyReplay(audit, chain);
  const lastSeq = audit.length ? audit[audit.length - 1].seq : 0;
  const entries = chain.state === "empty" ? 0 : chain.entries;
  const missing = chain.state === "broken" && chain.brokenAt > lastSeq;
  const running = replay.status === "running";
  const state = running ? "checking" : chain.state;

  return (
    <div className="log-head" data-state={state} data-tour="log-head">
      <div className="log-verdict">
        <span className="log-icon" aria-hidden="true">
          {state === "verified" ? <CircleCheck /> : state === "broken" ? <CircleX /> : <LoaderCircle className={state === "checking" ? "spin" : undefined} />}
        </span>
        <div>
          <p className="log-title" aria-live="polite">
            {running ? "Checking every entry…" : headline(chain, missing)}
          </p>
          <p className="log-sub">
            {chain.state === "empty" ? "Each step is signed and chained here as it happens." : `${count(entries)} ${entries === 1 ? "entry" : "entries"} · ${CHECKED[audience]}`}
          </p>
        </div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={verifyAgain} disabled={running || audit.length === 0}>
        <RefreshCw aria-hidden="true" className={running ? "spin" : undefined} />
        Verify again
      </button>
      <VerifySteps state={replay} />
      {chain.state === "broken" ? (
        <p className="log-alarm" role="alert">
          {missing ? "The newest entries this browser saw are gone." : `Entry ${chain.brokenAt} was changed after it was written.`} {PAUSED_UNTIL_RESTORED}
        </p>
      ) : null}
      <p className="log-why">{DISPUTE_LINE}</p>
      <TechDetails
        rows={[
          { label: "Public keys", value: <a href="/.well-known/jwks.json" target="_blank" rel="noreferrer">/.well-known/jwks.json</a>, mono: true },
          { label: "Newest entry", value: chain.state === "verified" && chain.head ? `${lastSeq} · ${shortHash(chain.head)}` : undefined, mono: true },
        ]}
      />
    </div>
  );
}
