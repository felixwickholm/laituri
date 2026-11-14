import type { Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { isSeeded, orderOutcome } from "@/lib/console/format/orders";
import { offerSubject } from "@/lib/console/format/proof";
import { dayAndTime } from "@/lib/console/format/time";
import { DemoTag } from "../ui/DemoTag";
import { StateWord } from "../ui/StateWord";

/** A decided order: how it ended, the amount, and what was asked. */
export function HandledRow({ order, onOpen }: { order: Order; onOpen: (orderId: string) => void }) {
  const outcome = orderOutcome(order);
  const what = order.offer.intent?.trim() || offerSubject(order.offer);
  return (
    <li>
      <button type="button" className="handled" onClick={() => onOpen(order.id)}>
        <span className="handled-what">{what}</span>
        <span className="handled-amount">{eur(order.offer.totals.net.amount)}</span>
        <span className="handled-state">
          <StateWord word={outcome.rule ? `${outcome.label} · ${outcome.rule}` : outcome.label} tone={outcome.tone} />
          <span className="handled-when">{dayAndTime(order.updatedAt)}</span>
          {isSeeded(order) ? <DemoTag /> : null}
        </span>
      </button>
    </li>
  );
}
