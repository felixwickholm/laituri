"use client";

import { useMemo, useState } from "react";
import type { AuditEntry, Order } from "@/lib/contracts";
import { auditDetail, auditTitle } from "@/lib/console/format/audit";
import { clock } from "@/lib/console/format/time";
import type { ChainState, Jwks, SignedMandate } from "@/lib/console/types";
import { EmptyLine, Pane, type Feed } from "../shell/Pane";
import { useUi } from "../shell/ui-context";
import { AuditSheet } from "./AuditSheet";
import { ChainEntry, linkState } from "./ChainEntry";
import { ChainExample } from "./ChainExample";
import { ProofHead } from "./ProofHead";

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
        <>
          <EmptyLine feed={feed}>The log is empty. Every step the agent takes is signed and chained here.</EmptyLine>
          {feed === "ok" ? <ChainExample /> : null}
        </>
      ) : (
        <ol className="audit-list chain" data-chain={chain.state} aria-label="Audit log, newest first">
          {newestFirst.map((item) => (
            <ChainEntry
              key={item.seq}
              state={linkState(item.seq, chain)}
              title={auditTitle(item)}
              detail={chain.state === "broken" && chain.brokenAt === item.seq ? chain.reason : auditDetail(item, orders)}
              time={clock(item.at)}
              dateTime={item.at}
              alert={item.event === "access.refused" || item.event === "order.blocked"}
              onOpen={() => setOpenSeq(item.seq)}
            />
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
