"use client";

import { useMemo, useState } from "react";
import type { AuditEntry, Order } from "@/lib/contracts";
import { auditTitle } from "@/lib/console/format/audit";
import { plainSentence } from "@/lib/console/format/sentence";
import { clock } from "@/lib/console/format/time";
import type { ChainState, Jwks, SignedMandate } from "@/lib/console/types";
import { EmptyLine, Pane, type Feed } from "../shell/Pane";
import { useUi } from "../shell/ui-context";
import { AuditSheet } from "./AuditSheet";
import { ProofHead } from "./ProofHead";

function AuditRow({ entry, chain, onOpen }: { entry: AuditEntry; chain: ChainState; onOpen: (seq: number) => void }) {
  const broken = chain.state === "broken" && chain.brokenAt === entry.seq;
  const after = chain.state === "broken" && entry.seq > chain.brokenAt;
  return (
    <li>
      <button type="button" className="audit" data-broken={broken} data-after-break={after} onClick={() => onOpen(entry.seq)}>
        <span className="audit-title">{auditTitle(entry)}</span>
        <time className="mono" dateTime={entry.at}>
          {clock(entry.at)}
        </time>
        <span className="sentence">{broken && chain.state === "broken" ? chain.reason : plainSentence(entry.summary)}</span>
      </button>
    </li>
  );
}

interface ProofPaneProps {
  audit: AuditEntry[];
  chain: ChainState;
  orders: Order[];
  jwks?: Jwks;
  mandate?: SignedMandate;
  feed: Feed;
  visible: boolean;
}

export function ProofPane({ audit, chain, orders, jwks, mandate, feed, visible }: ProofPaneProps) {
  const ui = useUi();
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const newestFirst = useMemo(() => [...audit].reverse(), [audit]);
  const latest = useMemo(() => [...orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0], [orders]);
  const entry = audit.find((item) => item.seq === openSeq);

  return (
    <Pane id="proof" num={3} title="Proof" sub="What was logged and verified" visible={visible} alarm={chain.state === "broken"}>
      <ProofHead audit={audit} chain={chain} latest={latest} jwks={jwks} mandate={mandate} onOpenOrder={ui.openOrder} />
      {newestFirst.length === 0 ? (
        <EmptyLine feed={feed}>The log is empty. Every step the agent takes is signed and chained here.</EmptyLine>
      ) : (
        <ol className="audit-list" aria-label="Audit log, newest first">
          {newestFirst.map((item) => (
            <AuditRow key={item.seq} entry={item} chain={chain} onOpen={setOpenSeq} />
          ))}
        </ol>
      )}
      <AuditSheet
        entry={entry}
        open={openSeq !== null}
        chain={chain}
        jwks={jwks}
        onClose={() => setOpenSeq(null)}
        onOpenOrder={(id) => {
          setOpenSeq(null);
          ui.openOrder(id);
        }}
      />
    </Pane>
  );
}
