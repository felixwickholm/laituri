import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { eur } from "@/lib/console/format/money";
import { day } from "@/lib/console/format/time";
import { conceptLabel, quantityText, reasonLabel, unmetNet } from "@/lib/supplier-console/format";
import type { UnmetRequest } from "@/lib/supplier-console/types";

/** The top unserved requests: what was asked, by whom, why it went unserved, and what it was worth. */
export function UnservedPanel({ unmet, limit = 5 }: { unmet: UnmetRequest[]; limit?: number }) {
  const rows = [...unmet].sort((a, b) => (b.estimatedLostNet ?? 0) - (a.estimatedLostNet ?? 0) || b.at.localeCompare(a.at)).slice(0, limit);
  return (
    <section className="block" aria-labelledby="unserved-title">
      <header className="block-head">
        <h2 id="unserved-title">
          Unserved demand <span className="count">{eur(unmetNet(unmet))}</span>
        </h2>
        <Link href="/valio/demand#unserved" className="text-link block-link">
          Demand
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="empty-frame">Every request was served on time and in full.</p>
      ) : (
        <ul className="card unserved-list">
          {rows.map((item) => (
            <li key={item.requestId} className="unserved-line">
              <span className="unserved-what">
                <span className="unserved-words">{item.words ? `“${item.words}”` : conceptLabel(item.concept)}</span>
                <span className="sub">
                  {item.buyer?.name ?? item.agent.name} · {quantityText(item.quantity)} · {day(item.at)}
                </span>
              </span>
              <span className="reason-tag" data-reason={item.reason}>
                {reasonLabel(item.reason)}
              </span>
              <span className="unserved-net num">{item.estimatedLostNet === undefined ? <span className="dim">No price</span> : eur(item.estimatedLostNet)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
