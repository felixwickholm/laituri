import type { AuditEntry, Order } from "@/lib/contracts";
import { auditDetail, auditTitle } from "@/lib/console/format/audit";
import { linkState } from "@/lib/console/format/chain";
import { actorKind } from "@/lib/console/format/log";
import { clock, day } from "@/lib/console/format/time";
import { agentName } from "@/lib/supplier-console/names";
import type { ChainState } from "@/lib/console/types";

interface LogRowsProps {
  entries: AuditEntry[];
  chain: ChainState;
  orders: Order[];
  onOpen: (seq: number) => void;
}

const LINK_NOTE = { broken: "Changed after it was written", untrusted: "Written after the changed step" } as const;

/** The log as When / Who / What rows, newest first. A changed entry and every entry after it are marked. */
export function LogRows({ entries, chain, orders, onOpen }: LogRowsProps) {
  return (
    <div className="table-frame">
      <table className="log-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Who</th>
            <th scope="col">What</th>
            <th scope="col" className="num">
              Step
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const link = linkState(entry.seq, chain);
            const refused = entry.event === "access.refused" || entry.event === "order.blocked";
            return (
              <tr key={entry.seq} data-link={link} data-alert={refused}>
                <td className="cell-when">
                  <span>{day(entry.at)}</span>
                  <span className="sub">{clock(entry.at)}</span>
                </td>
                <td className="cell-who">
                  <span>{agentName(entry.actor)}</span>
                  {actorKind(entry) !== entry.actor.name ? <span className="sub">{actorKind(entry)}</span> : null}
                </td>
                <td className="cell-what">
                  <button type="button" className="row-open" onClick={() => onOpen(entry.seq)}>
                    {auditTitle(entry)}
                  </button>
                  <span className="sub">
                    {chain.state === "broken" && chain.brokenAt === entry.seq ? chain.reason : auditDetail(entry, orders)}
                  </span>
                  {link === "broken" || link === "untrusted" ? <span className="link-note">{LINK_NOTE[link]}</span> : null}
                </td>
                <td className="cell-seq num mono">{entry.seq}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
