"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/contracts";
import { shortHash } from "@/lib/console/format/activity";
import { plainSentence } from "@/lib/console/format/sentence";
import { dayAndTime } from "@/lib/console/format/time";
import type { ChainState, Jwks } from "@/lib/console/types";
import { checkSignature, type SignatureCheck } from "@/lib/console/verify";
import { CopyButton } from "../ui/CopyButton";
import { Sheet } from "../ui/Sheet";

const ROLE_KEY: Record<string, string> = {
  supplier: "Valio Aimo key",
  buyer: "buyer key",
  approver: "approver key",
};

function Hash({ value }: { value: string }) {
  return (
    <span className="hash-inline">
      <span className="mono">{shortHash(value)}</span>
      <CopyButton value={value} label="Copy" />
    </span>
  );
}

interface AuditSheetProps {
  entry?: AuditEntry;
  open: boolean;
  chain: ChainState;
  jwks?: Jwks;
  onClose: () => void;
  onOpenOrder: (orderId: string) => void;
}

/** One log entry as a key-value record, like a transparency-log entry, checked in this browser. */
export function AuditSheet({ entry, open, chain, jwks, onClose, onOpenOrder }: AuditSheetProps) {
  const [signature, setSignature] = useState<SignatureCheck | undefined>();

  useEffect(() => {
    let live = true;
    if (entry) void checkSignature(entry.signature, jwks).then((result) => live && setSignature(result));
    return () => {
      live = false;
    };
  }, [entry, jwks]);

  const broken = chain.state === "broken" && entry && entry.seq >= chain.brokenAt;
  const orderId = entry?.refs.orderId;
  return (
    <Sheet
      open={open && Boolean(entry)}
      onClose={onClose}
      kicker={entry ? `Entry ${entry.seq}` : undefined}
      title={entry?.event ?? "Entry"}
      lede={entry ? plainSentence(entry.summary) : undefined}
      footer={
        orderId ? (
          <span className="end">
            <button type="button" className="btn" onClick={() => onOpenOrder(orderId)}>
              Open the order
            </button>
          </span>
        ) : undefined
      }
    >
      {entry ? (
        <>
          {broken && chain.state === "broken" ? (
            <p className="callout tone-danger">
              {entry.seq === chain.brokenAt ? chain.reason : `This entry comes after entry ${chain.brokenAt}, which was changed.`} It can no longer be trusted.
            </p>
          ) : null}
          <dl className="kv record">
            <dt>Sequence</dt>
            <dd className="mono">{entry.seq}</dd>
            <dt>Time</dt>
            <dd>{dayAndTime(entry.at)}</dd>
            <dt>Actor</dt>
            <dd>
              {entry.actor.name} <span className="dim">· {entry.actor.type}</span>
            </dd>
            <dt>Hash</dt>
            <dd>
              <Hash value={entry.hash} />
            </dd>
            <dt>Previous hash</dt>
            <dd>
              <Hash value={entry.prevHash} />
            </dd>
            <dt>Signature</dt>
            <dd>
              {signature?.valid ? (
                <span className="sig-state tone-success">
                  <CircleCheck aria-hidden="true" />
                  Verified against {ROLE_KEY[signature.role ?? "supplier"]}
                </span>
              ) : signature ? (
                <span className="sig-state tone-danger">
                  <CircleX aria-hidden="true" />
                  Signature does not match{signature.reason ? `: ${signature.reason}` : ""}
                </span>
              ) : (
                <span className="sig-state">Checking</span>
              )}
              <Hash value={entry.signature.split(".")[2] ?? entry.signature} />
            </dd>
          </dl>
          <section className="section">
            <h3>Payload</h3>
            <pre className="payload mono">{JSON.stringify({ refs: entry.refs, data: entry.data }, null, 2)}</pre>
          </section>
        </>
      ) : null}
    </Sheet>
  );
}
