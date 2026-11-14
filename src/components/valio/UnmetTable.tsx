import { eur } from "@/lib/console/format/money";
import { day, hourMinute } from "@/lib/console/format/time";
import { conceptLabel, quantityText } from "@/lib/supplier-console/format";
import { agentName, clientName } from "@/lib/supplier-console/names";
import type { UnmetRequest } from "@/lib/supplier-console/types";
import { Dash } from "../ui/Dash";
import { ReasonTag } from "./bits";

/** Every unserved request: when, who, the buyer's own words, how much, by when, why, and what it was worth. */
export function UnmetTable({ rows, filtered }: { rows: UnmetRequest[]; filtered: boolean }) {
  return (
    <div className="table-frame">
      <table className="unmet-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Buyer</th>
            <th scope="col">The buyer&rsquo;s words</th>
            <th scope="col" className="num">
              Quantity
            </th>
            <th scope="col">Wanted by</th>
            <th scope="col">Reason</th>
            <th scope="col" className="num">
              Est. lost net
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={7}>{filtered ? "No unserved requests for this reason." : "Every request was served on time and in full."}</td>
            </tr>
          ) : (
            rows.map((item) => (
              <tr key={item.requestId}>
                <td className="cell-when">
                  <span>{day(item.at)}</span>
                  <span className="sub">{hourMinute(item.at)}</span>
                </td>
                <td className="cell-buyer">
                  <span>{item.buyer?.name ?? "No buyer named"}</span>
                  <span className="sub">
                    {agentName(item.agent)} · {clientName(item.client)}
                  </span>
                </td>
                <td className="cell-words">
                  <span className="words">
                    {item.words ? `“${item.words}”` : conceptLabel(item.concept)}
                  </span>
                  {item.concept && item.words && !item.words.toLowerCase().includes(conceptLabel(item.concept).toLowerCase()) ? (
                    <span className="sub">Read as {conceptLabel(item.concept).toLowerCase()}</span>
                  ) : null}
                </td>
                <td className="cell-qty num">{quantityText(item.quantity)}</td>
                <td className="cell-by">{item.deliverBy ? day(item.deliverBy) : <Dash />}</td>
                <td className="cell-reason">
                  <ReasonTag reason={item.reason} />
                </td>
                <td className="cell-lost num">{item.estimatedLostNet === undefined ? <Dash reason="no price" /> : eur(item.estimatedLostNet)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
