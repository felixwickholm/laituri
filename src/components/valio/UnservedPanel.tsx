import { ArrowRight, PackageCheck } from "lucide-react";
import Link from "next/link";
import { eur } from "@/lib/console/format/money";
import { day } from "@/lib/console/format/time";
import { conceptLabel, quantityText, unmetNet } from "@/lib/supplier-console/format";
import { agentName } from "@/lib/supplier-console/names";
import type { UnmetRequest } from "@/lib/supplier-console/types";
import { Dash } from "../ui/Dash";
import { EmptyState, ReasonTag } from "./bits";

/** The top unserved requests: what was asked, by whom, why it went unserved, and what it was worth. */
export function UnservedPanel({ unmet, limit = 5 }: { unmet: UnmetRequest[]; limit?: number }) {
  const rows = [...unmet].sort((a, b) => (b.estimatedLostNet ?? 0) - (a.estimatedLostNet ?? 0) || b.at.localeCompare(a.at)).slice(0, limit);
  const lost = unmetNet(unmet);
  return (
    <section className="block" aria-labelledby="unserved-title" data-tour="valio-unserved">
      <header className="block-head">
        <h2 id="unserved-title">
          Lost demand {lost > 0 ? <span className="count">{eur(lost)}</span> : null}
        </h2>
        <Link href="/valio/demand#unserved" className="text-link block-link">
          All
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      {rows.length === 0 ? (
        <EmptyState icon={PackageCheck} text="Every request served." />
      ) : (
        <div className="card list-card">
          <ul className="unserved-list">
            {rows.map((item) => (
              <li key={item.requestId} className="unserved-line">
                <span className="unserved-what">
                  <span className="unserved-words">{item.words ? `“${item.words}”` : conceptLabel(item.concept)}</span>
                  <span className="sub">
                    {item.buyer?.name ?? agentName(item.agent)} · {quantityText(item.quantity)} · {day(item.at)}
                  </span>
                </span>
                <ReasonTag reason={item.reason} />
                <span className="unserved-net num">{item.estimatedLostNet === undefined ? <Dash reason="no price" /> : eur(item.estimatedLostNet)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
