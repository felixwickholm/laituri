"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/contracts";
import { shortHash } from "@/lib/console/format/activity";
import { auditTitle } from "@/lib/console/format/audit";
import { plainSentence } from "@/lib/console/format/sentence";
import { dayAndTime } from "@/lib/console/format/time";
import type { ChainState, Jwks } from "@/lib/console/types";
import { checkSignature, type SignatureCheck } from "@/lib/console/verify";
import { agentName } from "@/lib/supplier-console/names";
import { CopyButton } from "../ui/CopyButton";
import { TechDetails } from "../ui/TechDetails";
import { Sheet } from "../ui/Sheet";

const ROLE_KEY: Record<string, string> = {
  supplier: "Valio Aimo key",
  buyer: "customer’s key",
  approver: "purchasing manager’s key",
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

/** One step of the record: when, who, and whether it checks out on this device; the raw entry behind Technical details. */
export function AuditSheet({ entry, open, chain, jwks, onClose, onOpenOrder }: AuditSheetProps) {
  const [signature, setSignature] = useState<SignatureCheck | undefined>();

  useEffect(() => {
    let live = true;
    if (entry) void checkSignature(entry.signature, jwks, "audit").then((result) => live && setSignature(result));
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
      kicker={entry ? `Step ${entry.seq}` : undefined}
      title={entry ? auditTitle(entry) : "Step"}
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
              {entry.seq === chain.brokenAt ? chain.reason : `This step comes after step ${chain.brokenAt}, which was changed.`} It can no longer be trusted.
            </p>
          ) : null}
          <dl className="kv record">
            <dt>Step</dt>
            <dd className="num">{entry.seq}</dd>
            <dt>Time</dt>
            <dd>{dayAndTime(entry.at)}</dd>
            <dt>Who</dt>
            <dd>{agentName(entry.actor)}</dd>
            <dt>Check</dt>
            <dd>
              {signature?.valid ? (
                <span className="sig-state tone-success">
                  <CircleCheck aria-hidden="true" />
                  Checked with the {ROLE_KEY[signature.role ?? "supplier"]}
                </span>
              ) : signature ? (
                <span className="sig-state tone-danger">
                  <CircleX aria-hidden="true" />
                  Does not check out{signature.reason ? `: ${signature.reason}` : ""}
                </span>
              ) : (
                <span className="sig-state">Checking</span>
              )}
            </dd>
          </dl>
          <TechDetails
            rows={[
              { label: "Event", value: entry.event, mono: true },
              { label: "Hash", value: <Hash value={entry.hash} /> },
              { label: "Previous hash", value: <Hash value={entry.prevHash} /> },
              { label: "Signature", value: <Hash value={entry.signature.split(".")[2] ?? entry.signature} /> },
              { label: "Payload", value: <pre className="payload mono">{JSON.stringify({ refs: entry.refs, data: entry.data }, null, 2)}</pre> },
            ]}
          />
        </>
      ) : null}
    </Sheet>
  );
}
