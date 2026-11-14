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
  buyer: "checked on your device",
  wholesaler: "checked on this device",
};

const PAUSED_UNTIL_RESTORED = "Approvals wait until the record is put back.";

function headline(chain: ChainState, missing: boolean): string {
  if (chain.state === "verified") return "Nothing changed after it was written";
  if (chain.state === "broken") return missing ? "Steps are missing" : `Step ${chain.brokenAt} changed after it was written`;
  if (chain.state === "checking") return "Checking";
  return "Nothing in the record yet";
}

interface LogHeadProps {
  audit: AuditEntry[];
  chain: ChainState;
  /** Defaults to the buyer, whose console is where the log first appeared. */
  audience?: LogAudience;
}

/** The record's seal: the verdict, the check on this device replayed step by step, and a way to run it again. */
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
          <h2 className="log-title" aria-live="polite">
            {running ? "Checking every step…" : headline(chain, missing)}
          </h2>
          <p className="log-sub">
            {chain.state === "empty" ? "Empty" : `${count(entries)} ${entries === 1 ? "step" : "steps"} · ${CHECKED[audience]}`}
          </p>
        </div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={verifyAgain} disabled={running || audit.length === 0}>
        <RefreshCw aria-hidden="true" className={running ? "spin" : undefined} />
        Check again
      </button>
      <VerifySteps state={replay} />
      {chain.state === "broken" ? (
        <p className="log-alarm" role="alert">
          {missing ? "The newest steps this device saw are gone." : `Step ${chain.brokenAt} was changed after it was written.`} {PAUSED_UNTIL_RESTORED}
        </p>
      ) : null}
      <TechDetails
        rows={[
          { label: "Public keys", value: <a href="/.well-known/jwks.json" target="_blank" rel="noreferrer">/.well-known/jwks.json</a>, mono: true },
          { label: "Newest entry", value: chain.state === "verified" && chain.head ? `${lastSeq} · ${shortHash(chain.head)}` : undefined, mono: true },
        ]}
      />
    </div>
  );
}
