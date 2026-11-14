"use client";

import type { AuditEntry } from "@/lib/contracts";
import { plainSentence } from "@/lib/console/format/sentence";
import { clock } from "@/lib/console/format/time";
import type { ChainState } from "@/lib/console/types";
import { Pane } from "../shell/Pane";
import { useUi } from "../shell/ui-context";
import { ChainBadge } from "./ChainBadge";
import { ProofTools } from "./ProofTools";

function AuditRow({ entry, chain, onOpen }: { entry: AuditEntry; chain: ChainState; onOpen: (id: string) => void }) {
  const broken = chain.state === "broken" && chain.brokenAt === entry.seq;
  const after = chain.state === "broken" && entry.seq > chain.brokenAt;
  const orderId = entry.refs.orderId;
  const body = (
    <>
      <span className="event">
        <span className="seq">{entry.seq}</span>
        {entry.event}
      </span>
      <time className="mono" dateTime={entry.at}>
        {clock(entry.at)}
      </time>
      <span className="sentence">{broken && chain.state === "broken" ? chain.reason : plainSentence(entry.summary)}</span>
    </>
  );
  return (
    <li>
      {orderId ? (
        <button type="button" className="audit" data-clickable="true" data-broken={broken} data-after-break={after} onClick={() => onOpen(orderId)}>
          {body}
        </button>
      ) : (
        <div className="audit" data-broken={broken} data-after-break={after}>
          {body}
        </div>
      )}
    </li>
  );
}

export function ProofPane({ audit, chain, visible }: { audit: AuditEntry[]; chain: ChainState; visible: boolean }) {
  const ui = useUi();
  const newestFirst = [...audit].reverse();
  return (
    <Pane id="proof" num={3} title="Proof" sub="What was logged and verified" visible={visible}>
      <div className="chain-row" data-state={chain.state}>
        <ChainBadge chain={chain} lastSeq={audit.length ? audit[audit.length - 1].seq : 0} />
        <span className="meta">Checked in your browser</span>
        <ProofTools />
      </div>
      {newestFirst.length === 0 ? (
        <p className="pane-empty">The log is empty. Every step the agent takes is signed and chained here.</p>
      ) : (
        <ol className="audit-list" aria-label="Audit log, newest first">
          {newestFirst.map((entry) => (
            <AuditRow key={entry.seq} entry={entry} chain={chain} onOpen={ui.openOrder} />
          ))}
        </ol>
      )}
    </Pane>
  );
}
