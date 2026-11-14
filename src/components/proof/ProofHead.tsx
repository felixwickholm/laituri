"use client";

import { PenLine } from "lucide-react";
import type { AuditEntry, Order } from "@/lib/contracts";
import { shortName } from "@/lib/console/format/rules";
import { hourMinute } from "@/lib/console/format/time";
import type { ChainState, Jwks, SignedMandate } from "@/lib/console/types";
import { useOrderProof } from "../order/useOrderProof";
import { ChainBadge } from "./ChainBadge";
import { ProofTools } from "./ProofTools";

interface ProofHeadProps {
  audit: AuditEntry[];
  chain: ChainState;
  latest?: Order;
  jwks?: Jwks;
  mandate?: SignedMandate;
  onOpenOrder: (orderId: string) => void;
}

/** The newest human signature in the log, shown as a stamp line. */
function lastStamp(audit: AuditEntry[]): AuditEntry | undefined {
  for (let i = audit.length - 1; i >= 0; i -= 1) {
    const entry = audit[i];
    if (entry.event === "approval.granted" || (entry.event === "approval.rejected" && entry.actor.type === "human")) return entry;
  }
  return undefined;
}

/** Pinned at the top of pane 3: the chain state, the latest order's signatures, and the newest human signature. */
export function ProofHead({ audit, chain, latest, jwks, mandate, onOpenOrder }: ProofHeadProps) {
  const proof = useOrderProof(latest, jwks, mandate, audit);
  const signed = proof.signatures.filter((row) => row.state === "valid").length;
  const failed = proof.signatures.some((row) => row.state === "invalid");
  const stamp = lastStamp(audit);
  const lastSeq = audit.length ? audit[audit.length - 1].seq : 0;

  return (
    <div className="proof-head" data-state={chain.state}>
      <div className="chain-row">
        <ChainBadge chain={chain} lastSeq={lastSeq} />
        <span className="meta">Checked in your browser</span>
        <ProofTools />
      </div>
      {chain.state === "broken" ? (
        <p className="alarm" role="alert">
          {chain.reason} Everything after it can no longer be trusted.
        </p>
      ) : latest && proof.signatures.length > 0 ? (
        <button type="button" className="proof-line" onClick={() => onOpenOrder(latest.id)}>
          <span className={failed ? "tone-danger" : undefined}>
            {failed ? "A signature on the latest order does not match" : `${signed} ${signed === 1 ? "signature" : "signatures"} on the latest order verified`}
          </span>
          <span className="mono order-id">{latest.id}</span>
        </button>
      ) : null}
      {stamp && chain.state !== "broken" ? (
        <p key={stamp.seq} className="stamp">
          <PenLine aria-hidden="true" />
          {stamp.event === "approval.granted" ? "Approved" : "Rejected"} and signed by {shortName(stamp.actor.name)} at {hourMinute(stamp.at)}
          <span className="mono">entry {stamp.seq}</span>
        </p>
      ) : null}
    </div>
  );
}
