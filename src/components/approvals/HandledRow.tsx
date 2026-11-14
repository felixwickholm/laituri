import type { Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { offeredLine } from "@/lib/console/format/proof";
import { blockedLine, handledState, HANDLED_WORD, shortName } from "@/lib/console/format/rules";
import { hourMinute } from "@/lib/console/format/time";

function why(order: Order): string {
  const state = handledState(order);
  if (state === "blocked") return blockedLine(order);
  if (state === "approved" || state === "rejected") {
    return `${HANDLED_WORD[state]} by ${shortName(order.approval?.decidedBy.name ?? "a person")} at ${hourMinute(order.approval?.decidedAt)}.`;
  }
  if (state === "expired") return "The offer expired before anyone decided.";
  return `Inside the mandate. All ${order.decision.checks.length} checks passed.`;
}

/** A decided order: what, how much, the state word, and one line on why. */
export function HandledRow({ order, onOpen }: { order: Order; onOpen: (orderId: string) => void }) {
  const state = handledState(order);
  const tone = state === "blocked" ? "tone-danger" : state === "rejected" || state === "expired" ? "" : "tone-success";
  return (
    <li>
      <button type="button" className="handled" onClick={() => onOpen(order.id)}>
        <span className="what">{offeredLine(order.offer).replace(/^Offered: /, "")}</span>
        <span className="amount mono">{eur(order.offer.totals.net.amount)}</span>
        <span className={`why ${state === "blocked" ? "tone-danger" : ""}`}>{why(order)}</span>
        <span className={`state-word ${tone}`}>{HANDLED_WORD[state]}</span>
      </button>
    </li>
  );
}
